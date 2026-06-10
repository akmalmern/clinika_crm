'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState, LoadingState } from '@/components/common/states';
import { useCan } from '@/components/session-provider';
import { Permission } from '@/lib/auth/permissions';
import { apiGet, apiGetPage } from '@/lib/api/client';
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
} from '@/lib/constants';
import {
  addDays,
  formatDayLabel,
  formatTime,
  localDayRangeUtc,
  toLocalDateValue,
  weekDays,
} from '@/lib/format';
import type { Appointment, FreeSlot } from '@/types/domain';
import { useDoctors } from './use-doctors';
import { BookingDialog } from './booking-dialog';
import { StatusMenu } from './status-menu';
import { SchedulesDialog } from './schedules-dialog';

type View = 'day' | 'week';

export function AppointmentsClient() {
  const can = useCan();
  const canManage = can(Permission.APPOINTMENT_MANAGE);
  const canStatus = can(Permission.APPOINTMENT_STATUS);
  const canSchedule = can(Permission.SCHEDULE_MANAGE);

  const doctors = useDoctors();
  const [doctorId, setDoctorId] = useState('');
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(toLocalDateValue(new Date()));

  const [booking, setBooking] = useState<{
    open: boolean;
    slot?: string;
    date?: string;
  }>({ open: false });
  const [schedulesOpen, setSchedulesOpen] = useState(false);

  useEffect(() => {
    if (!doctorId && doctors.data?.length) setDoctorId(doctors.data[0].id);
  }, [doctors.data, doctorId]);

  return (
    <div className="space-y-5">
      <PageHeader title="Qabullar" description="Kalendar va navbatga yozish.">
        <div className="flex items-center gap-2">
          {canSchedule && (
            <Button variant="outline" onClick={() => setSchedulesOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Ish jadvali
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setBooking({ open: true, date })}>
              <Plus className="h-4 w-4" />
              Yangi qabul
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Select value={doctorId || undefined} onValueChange={setDoctorId}>
          <SelectTrigger className="lg:w-64">
            <SelectValue placeholder="Shifokorni tanlang" />
          </SelectTrigger>
          <SelectContent>
            {doctors.data?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(addDays(date, view === 'week' ? -7 : -1))}
            aria-label="Oldingi"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setDate(toLocalDateValue(new Date()))}>
            Bugun
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(addDays(date, view === 'week' ? 7 : 1))}
            aria-label="Keyingi"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <div className="ml-1 inline-flex rounded-md border p-0.5">
            <Button
              variant={view === 'day' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
            >
              <Clock className="h-4 w-4" />
              Kun
            </Button>
            <Button
              variant={view === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
            >
              <CalendarDays className="h-4 w-4" />
              Hafta
            </Button>
          </div>
        </div>
      </div>

      {!doctorId ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              title="Shifokorni tanlang"
              description="Kalendarni ko'rish uchun shifokorni tanlang."
              icon={CalendarClock}
            />
          </CardContent>
        </Card>
      ) : view === 'day' ? (
        <DayView
          doctorId={doctorId}
          date={date}
          canManage={canManage}
          canStatus={canStatus}
          onBook={(slot) => setBooking({ open: true, slot, date })}
        />
      ) : (
        <WeekView
          doctorId={doctorId}
          date={date}
          onPickDay={(d) => {
            setDate(d);
            setView('day');
          }}
        />
      )}

      <BookingDialog
        open={booking.open}
        onOpenChange={(o) => setBooking((b) => ({ ...b, open: o }))}
        defaultDoctorId={doctorId}
        defaultDate={booking.date}
        defaultSlotStart={booking.slot}
      />
      <SchedulesDialog open={schedulesOpen} onOpenChange={setSchedulesOpen} />
    </div>
  );
}

// ---- Kun ko'rinishi ----
interface DayEntry {
  key: string;
  startUtc: string;
  time: string;
  appt?: Appointment;
  slot?: FreeSlot;
}

function DayView({
  doctorId,
  date,
  canManage,
  canStatus,
  onBook,
}: {
  doctorId: string;
  date: string;
  canManage: boolean;
  canStatus: boolean;
  onBook: (slotStart: string) => void;
}) {
  const range = localDayRangeUtc(date);
  const appts = useQuery({
    queryKey: ['appointments', { doctorId, date }],
    queryFn: () =>
      apiGetPage<Appointment>(
        `/clinic/appointments?doctorId=${doctorId}&from=${range.from}&to=${range.to}&limit=100`,
      ),
  });
  const slots = useQuery({
    queryKey: ['free-slots', doctorId, date],
    queryFn: () =>
      apiGet<FreeSlot[]>(
        `/clinic/appointments/free-slots?doctorId=${doctorId}&date=${date}`,
      ),
  });

  const entries: DayEntry[] = useMemo(() => {
    const list: DayEntry[] = [];
    for (const a of appts.data?.items ?? []) {
      list.push({
        key: `a-${a.id}`,
        startUtc: a.scheduledAt,
        time: formatTime(a.scheduledAt),
        appt: a,
      });
    }
    for (const s of slots.data ?? []) {
      list.push({ key: `s-${s.start}`, startUtc: s.start, time: s.startLocal, slot: s });
    }
    return list.sort((x, y) => x.startUtc.localeCompare(y.startUtc));
  }, [appts.data, slots.data]);

  if (appts.isLoading || slots.isLoading) return <LoadingState />;

  return (
    <Card>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <EmptyState
            title="Bu kunda yozuv yo'q"
            description="Bo'sh slot yo'q yoki ish vaqti belgilanmagan."
            icon={CalendarClock}
          />
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li
                key={e.key}
                className="flex items-center gap-4 px-4 py-3 text-sm"
              >
                <span className="w-14 font-mono text-muted-foreground">
                  {e.time}
                </span>
                {e.appt ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {e.appt.patientName ?? 'Bemor'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.appt.serviceName ?? 'Xizmatsiz'}
                      </p>
                    </div>
                    <StatusBadge
                      value={e.appt.status}
                      labels={APPOINTMENT_STATUS_LABEL}
                      variants={APPOINTMENT_STATUS_VARIANT}
                    />
                    {canStatus && <StatusMenu appointment={e.appt} />}
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-muted-foreground">Bo&apos;sh</span>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBook(e.slot!.start)}
                      >
                        <Plus className="h-4 w-4" />
                        Band qilish
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Hafta ko'rinishi ----
function WeekView({
  doctorId,
  date,
  onPickDay,
}: {
  doctorId: string;
  date: string;
  onPickDay: (d: string) => void;
}) {
  const days = useMemo(() => weekDays(date), [date]);
  const range = {
    from: localDayRangeUtc(days[0]).from,
    to: localDayRangeUtc(days[6]).to,
  };
  const query = useQuery({
    queryKey: ['appointments', { doctorId, week: days[0] }],
    queryFn: () =>
      apiGetPage<Appointment>(
        `/clinic/appointments?doctorId=${doctorId}&from=${range.from}&to=${range.to}&limit=200`,
      ),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const d of days) map.set(d, []);
    for (const a of query.data?.items ?? []) {
      const d = toLocalDateValue(a.scheduledAt);
      map.get(d)?.push(a);
    }
    for (const list of map.values())
      list.sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
    return map;
  }, [query.data, days]);

  if (query.isLoading) return <LoadingState />;

  const today = toLocalDateValue(new Date());

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        return (
          <Card key={d} className={d === today ? 'ring-1 ring-primary' : undefined}>
            <button
              type="button"
              onClick={() => onPickDay(d)}
              className="w-full border-b px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
            >
              {formatDayLabel(d)}
            </button>
            <CardContent className="space-y-1.5 p-2">
              {list.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">—</p>
              ) : (
                list.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border bg-card p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-muted-foreground">
                        {formatTime(a.scheduledAt)}
                      </span>
                      <StatusBadge
                        value={a.status}
                        labels={APPOINTMENT_STATUS_LABEL}
                        variants={APPOINTMENT_STATUS_VARIANT}
                      />
                    </div>
                    <p className="mt-1 truncate font-medium">
                      {a.patientName ?? 'Bemor'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
