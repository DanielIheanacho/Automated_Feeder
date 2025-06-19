
"use client";

import type { ScheduleEntry } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock3, Repeat, CheckCircle, XCircle } from "lucide-react"; 
import { Badge } from "@/components/ui/badge";

interface ScheduleListProps {
  currentSchedule: ScheduleEntry | null;
  onToggleSchedule: (id: string) => void;
}

export function ScheduleList({ currentSchedule, onToggleSchedule }: ScheduleListProps) {
  if (!currentSchedule) {
    return (
      <Card className="text-center py-8 border-dashed shadow-sm">
        <CardContent>
          <Clock3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No active schedule set.</p>
          <p className="text-sm text-muted-foreground">Use the form above to set an active schedule.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center gap-2 text-primary">
            {currentSchedule.enabled ? <CheckCircle className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
            Active Schedule
        </CardTitle>
        <CardDescription>View and manage your active feeding schedule. Previous schedule configurations are moved to the log upon update.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Time for first meal</TableHead>
                <TableHead><Repeat className="inline h-4 w-4 mr-1"/>Frequency</TableHead>
                <TableHead>Amount (grams)</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className={!currentSchedule.enabled ? "opacity-60" : ""}>
                <TableCell className="font-medium">{currentSchedule.time}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{currentSchedule.frequency}</Badge>
                </TableCell>
                <TableCell>{currentSchedule.amount}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={currentSchedule.enabled}
                    onCheckedChange={() => onToggleSchedule(currentSchedule.id)}
                    aria-label={currentSchedule.enabled ? "Disable schedule" : "Enable schedule"}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
