import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import {
  buildPaginationMeta,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { AuditService } from '../audit/audit.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';

type ServiceRow = Prisma.ServiceGetPayload<object>;
type PriceHistoryRow = Prisma.ServicePriceHistoryGetPayload<object>;

export interface ServiceResponse {
  id: string;
  name: string;
  price: string;
  currency: string;
  categoryId: string | null;
  duration: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface PriceHistoryResponse {
  id: string;
  oldPrice: string;
  newPrice: string;
  changedBy: string | null;
  changedAt: Date;
}

/**
 * Xizmatlar (spec 7.8). Narx o'zgarganda HAR safar service_price_history'ga
 * yoziladi (kim/qachon/eski->yangi) — bitta atomik tranzaksiyada. Soft-delete:
 * o'chirilgan xizmat eski qabullar narx tarixiga ta'sir qilmaydi.
 */
@Injectable()
export class ServicesService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateServiceDto,
  ): Promise<ServiceResponse> {
    await this.assertNameFree(clinicId, dto.name);
    if (dto.categoryId) await this.assertCategory(clinicId, dto.categoryId);

    const svc = await this.prisma.service.create({
      data: {
        clinicId,
        categoryId: dto.categoryId,
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency ?? 'UZS',
        duration: dto.duration,
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditService.log({
      action: 'SERVICE_CREATE',
      entity: 'Service',
      entityId: svc.id,
      clinicId,
      metadata: { price: dto.price },
    });
    return toServiceResponse(svc);
  }

  async findAll(
    clinicId: string,
    query: ListServicesQueryDto,
  ): Promise<Paginated<ServiceResponse>> {
    const where: Prisma.ServiceWhereInput = { clinicId, deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search)
      where.name = { contains: query.search, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return {
      items: rows.map(toServiceResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(clinicId: string, id: string): Promise<ServiceResponse> {
    return toServiceResponse(await this.getOrThrow(clinicId, id));
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdateServiceDto,
    userId: string,
  ): Promise<ServiceResponse> {
    const service = await this.getOrThrow(clinicId, id);
    if (dto.name && dto.name !== service.name) {
      await this.assertNameFree(clinicId, dto.name, id);
    }
    if (dto.categoryId) await this.assertCategory(clinicId, dto.categoryId);

    const data: Prisma.ServiceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.duration !== undefined) data.duration = dto.duration;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }

    // Narx o'zgarganmi? -> tarixga yozamiz (atomik)
    const newPrice =
      dto.price !== undefined ? new Prisma.Decimal(dto.price) : null;
    const priceChanged = !!newPrice && !newPrice.equals(service.price);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (priceChanged && newPrice) {
        await tx.servicePriceHistory.create({
          data: {
            clinicId,
            serviceId: id,
            oldPrice: service.price,
            newPrice,
            changedBy: userId,
          },
        });
        data.price = newPrice;
      }
      return tx.service.update({ where: { id }, data });
    });

    await this.auditService.log({
      action: priceChanged ? 'SERVICE_PRICE_CHANGE' : 'SERVICE_UPDATE',
      entity: 'Service',
      entityId: id,
      clinicId,
      userId,
      metadata: priceChanged
        ? {
            oldPrice: service.price.toString(),
            newPrice: newPrice ? newPrice.toString() : '',
          }
        : {},
    });
    return toServiceResponse(updated);
  }

  async remove(clinicId: string, id: string): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, id);
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.auditService.log({
      action: 'SERVICE_DELETE',
      entity: 'Service',
      entityId: id,
      clinicId,
    });
    return { id };
  }

  async priceHistory(
    clinicId: string,
    id: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<PriceHistoryResponse>> {
    await this.getOrThrow(clinicId, id);
    const where: Prisma.ServicePriceHistoryWhereInput = {
      clinicId,
      serviceId: id,
    };
    const [rows, total] = await Promise.all([
      this.prisma.servicePriceHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.servicePriceHistory.count({ where }),
    ]);
    return {
      items: rows.map(toPriceHistoryResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  // ---- private ----

  private async getOrThrow(clinicId: string, id: string): Promise<ServiceRow> {
    const svc = await this.prisma.service.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!svc) throw new NotFoundException('Xizmat topilmadi');
    return svc;
  }

  private async assertCategory(
    clinicId: string,
    categoryId: string,
  ): Promise<void> {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, clinicId, deletedAt: null },
    });
    if (!cat) throw new BadRequestException('Kategoriya topilmadi');
  }

  private async assertNameFree(
    clinicId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.service.findFirst({
      where: { clinicId, name, deletedAt: null },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Bu nomli xizmat allaqachon mavjud');
    }
  }
}

export function toServiceResponse(s: ServiceRow): ServiceResponse {
  return {
    id: s.id,
    name: s.name,
    price: s.price.toString(),
    currency: s.currency,
    categoryId: s.categoryId,
    duration: s.duration,
    isActive: s.isActive,
    createdAt: s.createdAt,
  };
}

export function toPriceHistoryResponse(
  h: PriceHistoryRow,
): PriceHistoryResponse {
  return {
    id: h.id,
    oldPrice: h.oldPrice.toString(),
    newPrice: h.newPrice.toString(),
    changedBy: h.changedBy,
    changedAt: h.changedAt,
  };
}
