import {
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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryRow = Prisma.ServiceCategoryGetPayload<object>;

export interface CategoryResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

/** Xizmat kategoriyalari (spec 7.8) — mustaqil CRUD. Faqat ruxsatli rol (SERVICE_MANAGE). */
@Injectable()
export class ServiceCategoriesService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly auditService: AuditService,
  ) {}

  async create(
    clinicId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    await this.assertNameFree(clinicId, dto.name);
    const cat = await this.prisma.serviceCategory.create({
      data: {
        clinicId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditService.log({
      action: 'SERVICE_CATEGORY_CREATE',
      entity: 'ServiceCategory',
      entityId: cat.id,
      clinicId,
    });
    return toCategoryResponse(cat);
  }

  async findAll(
    clinicId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<CategoryResponse>> {
    const where: Prisma.ServiceCategoryWhereInput = {
      clinicId,
      deletedAt: null,
    };
    if (query.search)
      where.name = { contains: query.search, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return {
      items: rows.map(toCategoryResponse),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(clinicId: string, id: string): Promise<CategoryResponse> {
    return toCategoryResponse(await this.getOrThrow(clinicId, id));
  }

  async update(
    clinicId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    await this.getOrThrow(clinicId, id);
    if (dto.name) await this.assertNameFree(clinicId, dto.name, id);

    const data: Prisma.ServiceCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const cat = await this.prisma.serviceCategory.update({
      where: { id },
      data,
    });
    await this.auditService.log({
      action: 'SERVICE_CATEGORY_UPDATE',
      entity: 'ServiceCategory',
      entityId: id,
      clinicId,
    });
    return toCategoryResponse(cat);
  }

  async remove(clinicId: string, id: string): Promise<{ id: string }> {
    await this.getOrThrow(clinicId, id);
    await this.prisma.serviceCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.auditService.log({
      action: 'SERVICE_CATEGORY_DELETE',
      entity: 'ServiceCategory',
      entityId: id,
      clinicId,
    });
    return { id };
  }

  private async getOrThrow(clinicId: string, id: string): Promise<CategoryRow> {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!cat) throw new NotFoundException('Kategoriya topilmadi');
    return cat;
  }

  private async assertNameFree(
    clinicId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { clinicId, name, deletedAt: null },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Bu nomli kategoriya allaqachon mavjud');
    }
  }
}

export function toCategoryResponse(c: CategoryRow): CategoryResponse {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}
