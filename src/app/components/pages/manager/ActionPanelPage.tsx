import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, PackageCheck, ShieldAlert, Siren, Truck } from 'lucide-react';
import { useManagerData } from './data';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';

export function ActionPanelPage() {
  const { loading, error, rows } = useManagerData();
  const navigate = useNavigate();

  const released = useMemo(() => rows.filter((r) => r.pipeline_state === 'ready_dispatch'), [rows]);
  const releasingTomorrow = useMemo(() => rows.filter((r) => r.days_to_release === 1), [rows]);
  const delayedVerification = useMemo(() => rows.filter((r) => r.verification_status === 'failed'), [rows]);

  const releasedCount = released.length;
  const releasingTomorrowCount = releasingTomorrow.length;
  const delayedVerificationCount = delayedVerification.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Action Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quick actions for today. Click a card to jump directly to the relevant pipeline list.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/pipeline')}>
            <ClipboardList className="size-4" />
            View full pipeline
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
        <Siren className="size-5 text-destructive" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">Action required</div>
          <div className="text-sm text-muted-foreground">
            {loading
              ? 'Loading latest counts…'
              : error
                ? error
                : 'Prioritize releases, pre-assignments, and failed validations.'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => navigate('/pipeline?stage=ready_dispatch')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-4 text-destructive" />
              Ready to dispatch
            </CardTitle>
            <CardDescription>Containers released and awaiting truck assignment.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold">{loading ? '—' : releasedCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Needs assignment</div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button className="w-full" disabled={loading || releasedCount === 0} onClick={(e) => { e.stopPropagation(); navigate('/pipeline?stage=ready_dispatch'); }}>
              Assign trucks
            </Button>
          </CardFooter>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => navigate('/pipeline?stage=releasing_soon')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4 text-amber-500" />
              Releasing tomorrow
            </CardTitle>
            <CardDescription>Pre-assign trucks now to avoid delays.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold">{loading ? '—' : releasingTomorrowCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Pre-assign candidates</div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              className="w-full"
              variant="secondary"
              disabled={loading || releasingTomorrowCount === 0}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/pipeline?stage=releasing_soon');
              }}
            >
              Pre-assign
            </Button>
          </CardFooter>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => navigate('/pipeline')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" />
              Validation issues
            </CardTitle>
            <CardDescription>Failed validation items blocking progress.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold">{loading ? '—' : delayedVerificationCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Needs attention</div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              className="w-full"
              variant="outline"
              disabled={loading || delayedVerificationCount === 0}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/pipeline');
              }}
            >
              Review issues
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
