
"use client";

import type { LogEntry } from "@/lib/types"; // Removed ScheduleEntry as it's not directly used for log structure here
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "./date-picker-with-range";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RotateCcw, PackageCheck, PackageX, History, Search, Trash2Icon, Info, CheckCircle, XCircle, Send, CheckCheck, UserCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { database } from '@/lib/firebase';
import { ref, onValue, off, query, orderByChild, limitToLast } from "firebase/database";
import type { RealtimeDatabaseMessageEntry } from "@/functions/src/interfaces";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

const LOG_STORAGE_KEY_PREFIX = "aquafeed-logs-client-"; // Prefix for account-specific client logs

const STATUS_SCHEDULE_SET = "Schedule Set";
const STATUS_SCHEDULE_UPDATED = "Schedule Updated";
const STATUS_SCHEDULE_CLEARED = "Schedule Cleared";
const STATUS_FEEDING_SUCCESS = "Success";
const STATUS_FEEDING_SKIPPED = "Skipped";
const STATUS_FEEDING_ERROR = "Error";
const STATUS_DEVICE_SYNC_SENT = "Device Sync: Config Sent";
const STATUS_DEVICE_SYNC_ACKNOWLEDGED = "Device Sync: Config Acknowledged";

const FILTER_SCHEDULES = "schedules";
const FILTER_FEEDINGS_AND_SYNC = "feedings_sync";

const initialLogs: LogEntry[] = []; // No global initial logs, fetched per user or empty

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_FEEDINGS_AND_SYNC);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { toast } = useToast();
  const auth = useAuth(); // Get auth context
  const logsRef = useRef(logs);

  const sanitizeFirebaseKey = (key: string) => {
    return key.replace(/[.#$[\]]/g, '_');
  };

  const getClientLogStorageKey = useCallback(() => {
    if (auth.user?.email) {
      return `${LOG_STORAGE_KEY_PREFIX}${sanitizeFirebaseKey(auth.user.email)}`;
    }
    return null;
  }, [auth.user?.email]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Load initial client-side logs from localStorage (specific to user)
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.email) {
      setLogs([]); // Clear logs if not authenticated
      return;
    }
    const storageKey = getClientLogStorageKey();
    if (!storageKey) return;

    let clientLogsToInitialize: LogEntry[] = [];
    const storedLogsRaw = localStorage.getItem(storageKey);

    if (storedLogsRaw) {
      try {
        const parsedLogs = JSON.parse(storedLogsRaw).map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
        if (Array.isArray(parsedLogs) && parsedLogs.every(log => log.timestamp instanceof Date && typeof log.status === 'string' && typeof log.id === 'string')) {
          clientLogsToInitialize = parsedLogs;
        }
      } catch (e) {
        console.warn("LogViewer: Error parsing client logs from localStorage for user.", e);
      }
    }
    setLogs(clientLogsToInitialize.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, [auth.isAuthenticated, auth.user?.email, getClientLogStorageKey]);


  // Firebase Realtime Database listener for /user_mqtt_logs/{accountId}/...
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.email) {
      // If user logs out or email is not available, clear RTDB logs and stop listening.
      setLogs(prevLogs => prevLogs.filter(log => !log.id.startsWith('rtdb-')));
      return;
    }
    
    const rawAccountId = auth.user.email;
    const sanitizedAccountId = sanitizeFirebaseKey(rawAccountId);
    const rtdbPath = `user_mqtt_logs/${sanitizedAccountId}`;
    console.log(`LogViewer: Setting up RTDB listener for path: ${rtdbPath}`);
    const mqttMessagesRef = query(ref(database, rtdbPath), orderByChild('receivedAt'), limitToLast(100));

    const listener = onValue(mqttMessagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rtdbLogs: LogEntry[] = [];
        // Data is { topic_path1: { timestamp1: msg1, timestamp2: msg2 }, topic_path2: { ... } }
        Object.values(data).forEach((topicMessages: any) => {
          if (typeof topicMessages === 'object' && topicMessages !== null) {
            Object.values(topicMessages).forEach((msgData: any) => {
              const rtdbMessage = msgData as RealtimeDatabaseMessageEntry;
              let status: LogEntry['status'] = STATUS_FEEDING_SUCCESS;
              let details: Partial<LogEntry> = {};

              // Determine status and details based on rtdbMessage content
              if (rtdbMessage.isAcknowledgement && rtdbMessage.acknowledgedSchedule) {
                status = STATUS_DEVICE_SYNC_ACKNOWLEDGED;
                details.scheduleDetails = {
                    time: rtdbMessage.acknowledgedSchedule.time,
                    frequency: rtdbMessage.acknowledgedSchedule.frequency as any,
                    amount: rtdbMessage.acknowledgedSchedule.amount,
                    enabled: rtdbMessage.acknowledgedSchedule.enabled,
                };
              } else if (rtdbMessage.isScheduleComponentUpdate) {
                status = `Device: Updated ${rtdbMessage.part}` as any;
                 details.scheduleDetails = {
                    time: rtdbMessage.part === 'time' ? String(rtdbMessage.value) : "N/A",
                    frequency: rtdbMessage.part === 'frequency' ? String(rtdbMessage.value) as any : "N/A",
                    amount: rtdbMessage.part === 'amount' ? String(rtdbMessage.value) : "N/A",
                    enabled: rtdbMessage.part === 'enabled' ? Boolean(rtdbMessage.value) : false,
                 };
                 details.notes = `Value: ${rtdbMessage.value}`;
              } else if (rtdbMessage.status === "feeding_error") {
                status = STATUS_FEEDING_ERROR;
                details.amount = rtdbMessage.amountFed || "N/A";
              } else if (rtdbMessage.status === "feeding_skipped") {
                status = STATUS_FEEDING_SKIPPED;
                details.amount = rtdbMessage.amountFed || "N/A";
              } else if (rtdbMessage.status && typeof rtdbMessage.status === 'string') {
                 status = `Device: ${rtdbMessage.status}` as any;
                 details.amount = rtdbMessage.temperature ? `${rtdbMessage.temperature}°C` : (rtdbMessage.payload?.toString() || "Data received");
              } else {
                 status = `Device: Message on ${rtdbMessage.topic}` as any;
                 details.notes = `Payload: ${payloadBufferToString(rtdbMessage.payload)}`;
              }
              
              rtdbLogs.push({
                id: `rtdb-${sanitizedAccountId}-${rtdbMessage.topic.replace(/\//g, '_')}-${rtdbMessage.timestamp}`, // Unique ID
                timestamp: new Date(rtdbMessage.timestamp || rtdbMessage.receivedAt),
                status: status,
                deviceId: rtdbMessage.deviceId || sanitizedAccountId, // deviceId from message, fallback to sanitizedAccountId
                ...details
              });
            });
          }
        });

        setLogs(prevClientLogs => {
          const clientLogsOnly = prevClientLogs.filter(log => !log.id.startsWith('rtdb-'));
          const combinedLogs = [...clientLogsOnly, ...rtdbLogs];
          combinedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          return combinedLogs.slice(0, 200);
        });
      } else {
        // No data for this user in RTDB path, clear existing RTDB logs from state
        setLogs(prevClientLogs => prevClientLogs.filter(log => !log.id.startsWith('rtdb-')));
      }
    }, (error) => {
      console.error(`Error listening to RTDB for logs at ${rtdbPath}:`, error);
      toast({ title: "Log Sync Error", description: "Could not fetch real-time logs.", variant: "destructive"});
    });

    return () => {
      console.log(`LogViewer: Cleaning up RTDB listener for path: ${rtdbPath}`);
      off(mqttMessagesRef, 'value', listener);
    };
  }, [auth.isAuthenticated, auth.user?.email, toast]);

  function payloadBufferToString(payload: any): string {
    if (payload === undefined || payload === null) return "N/A";
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object' && payload.type === 'Buffer' && Array.isArray(payload.data)) {
      try {
        return Buffer.from(payload.data).toString();
      } catch (e) { return "Invalid Buffer data"; }
    }
    try {
      return JSON.stringify(payload);
    } catch (e) {
      return String(payload);
    }
  }


  useEffect(() => {
    let tempLogs = [...logsRef.current];

    if (dateRange?.from) {
      tempLogs = tempLogs.filter(log => log.timestamp >= dateRange.from!);
    }
    if (dateRange?.to) {
      const inclusiveToDate = new Date(dateRange.to);
      inclusiveToDate.setDate(inclusiveToDate.getDate() + 1);
      tempLogs = tempLogs.filter(log => log.timestamp < inclusiveToDate);
    }

    if (activeFilter === FILTER_SCHEDULES) {
      tempLogs = tempLogs.filter(log =>
        log.status === STATUS_SCHEDULE_SET ||
        log.status === STATUS_SCHEDULE_UPDATED ||
        log.status === STATUS_SCHEDULE_CLEARED
      );
    } else if (activeFilter === FILTER_FEEDINGS_AND_SYNC) {
      tempLogs = tempLogs.filter(log =>
        log.status === STATUS_FEEDING_SUCCESS ||
        log.status === STATUS_FEEDING_SKIPPED ||
        log.status === STATUS_FEEDING_ERROR ||
        log.status === STATUS_DEVICE_SYNC_SENT ||
        log.status === STATUS_DEVICE_SYNC_ACKNOWLEDGED ||
        (typeof log.status === 'string' && log.status.startsWith("Device:"))
      );
    }

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempLogs = tempLogs.filter(log => {
        const statusText = getStatusDisplayText(log).toLowerCase();
        if (statusText.includes(lowerSearchTerm)) return true;
        if (log.notes && log.notes.toLowerCase().includes(lowerSearchTerm)) return true;
        if (log.amount && log.amount.toLowerCase().includes(lowerSearchTerm)) return true;
        if (log.deviceId && sanitizeFirebaseKey(log.deviceId).toLowerCase().includes(lowerSearchTerm)) return true;
        if (log.scheduleDetails) {
          if (
            log.scheduleDetails.amount.toLowerCase().includes(lowerSearchTerm) ||
            log.scheduleDetails.time.toLowerCase().includes(lowerSearchTerm) ||
            log.scheduleDetails.frequency.toLowerCase().includes(lowerSearchTerm)
          ) return true;
        }
        return false;
      });
    }

    setFilteredLogs(tempLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, [logs, dateRange, activeFilter, searchTerm]);

  const resetFilters = () => {
    setDateRange(undefined);
    setActiveFilter(FILTER_FEEDINGS_AND_SYNC);
    setSearchTerm("");
  };

  const getStatusBadgeVariant = (log: LogEntry) => {
    switch (log.status) {
      case STATUS_FEEDING_SUCCESS:
      case STATUS_DEVICE_SYNC_ACKNOWLEDGED:
        return 'default';
      case STATUS_FEEDING_SKIPPED:
      case STATUS_DEVICE_SYNC_SENT:
        return 'secondary';
      case STATUS_FEEDING_ERROR:
        return 'destructive';
      case STATUS_SCHEDULE_SET:
      case STATUS_SCHEDULE_UPDATED:
      case STATUS_SCHEDULE_CLEARED:
        return 'outline';
      default:
        if (typeof log.status === 'string' && log.status.toLowerCase().includes('error')) return 'destructive';
        return 'outline';
    }
  };

  const getStatusIcon = (log: LogEntry) => {
    const currentSanitizedUserEmail = auth.user?.email ? sanitizeFirebaseKey(auth.user.email) : "unknown_user_icon";
    switch (log.status) {
      case STATUS_FEEDING_SUCCESS: return <PackageCheck className="h-4 w-4 text-green-600" />;
      case STATUS_FEEDING_SKIPPED: return <History className="h-4 w-4 text-yellow-600" />;
      case STATUS_FEEDING_ERROR: return <PackageX className="h-4 w-4 text-red-600" />;
      case STATUS_SCHEDULE_SET:
      case STATUS_SCHEDULE_UPDATED:
        return log.scheduleDetails?.enabled
          ? <CheckCircle className="h-4 w-4 text-green-600" />
          : <XCircle className="h-4 w-4 text-red-600" />;
      case STATUS_SCHEDULE_CLEARED: return <Trash2Icon className="h-4 w-4 text-orange-600" />;
      case STATUS_DEVICE_SYNC_SENT: return <Send className="h-4 w-4 text-blue-600" />;
      case STATUS_DEVICE_SYNC_ACKNOWLEDGED: return <CheckCheck className="h-4 w-4 text-green-700" />;
      default:
        if (log.deviceId && log.deviceId !== currentSanitizedUserEmail) {
            return <UserCircle2 className="h-4 w-4 text-purple-600" />; // Different icon for other devices
        }
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatLogDetails = (log: LogEntry) => {
    let details = "";
    if (log.status === STATUS_SCHEDULE_SET || log.status === STATUS_SCHEDULE_UPDATED) {
      details = log.scheduleDetails ? `Config: ${log.scheduleDetails.amount} @ ${log.scheduleDetails.time} (${log.scheduleDetails.frequency}).` : 'N/A';
    } else if (log.status === STATUS_SCHEDULE_CLEARED) {
      details = log.scheduleDetails ? `Cleared: ${log.scheduleDetails.amount} @ ${log.scheduleDetails.time} (${log.scheduleDetails.frequency}), was ${log.scheduleDetails.enabled ? 'Enabled' : 'Disabled'}.` : 'N/A';
    } else if (log.status === STATUS_FEEDING_SUCCESS || log.status === STATUS_FEEDING_SKIPPED || log.status === STATUS_FEEDING_ERROR) {
      details = log.amount ? `Amount: ${log.amount}.` : 'Amount N/A.';
    } else if (log.status === STATUS_DEVICE_SYNC_SENT || log.status === STATUS_DEVICE_SYNC_ACKNOWLEDGED) {
      details = log.scheduleDetails ? `Config: ${log.scheduleDetails.amount} @ ${log.scheduleDetails.time} (${log.scheduleDetails.frequency}), enabled: ${log.scheduleDetails.enabled}.` : 'Synced schedule details N/A.';
    } else if (typeof log.status === 'string' && log.status.startsWith("Device:")) {
      details = log.amount || log.notes || 'Device data N/A.';
    } else {
        details = log.notes || 'N/A';
    }
    const currentSanitizedUserEmail = auth.user?.email ? sanitizeFirebaseKey(auth.user.email) : "unknown_user_log_details";
    if (log.deviceId && log.deviceId !== currentSanitizedUserEmail) {
        details += ` (Device: ${log.deviceId})`;
    } else if (log.deviceId === currentSanitizedUserEmail) {
        details += ` (My Device)`;
    }
    return details;
  };

  const getStatusDisplayText = (log: LogEntry) => {
    switch (log.status) {
      case STATUS_SCHEDULE_SET:
      case STATUS_SCHEDULE_UPDATED:
        return log.scheduleDetails?.enabled ? "Config: Schedule Active" : "Config: Schedule Inactive";
      case STATUS_SCHEDULE_CLEARED: return `Config: Schedule Cleared`;
      case STATUS_FEEDING_SUCCESS: return `Feeding: Success`;
      case STATUS_FEEDING_SKIPPED: return `Feeding: Skipped`;
      case STATUS_FEEDING_ERROR: return `Feeding: Error`;
      case STATUS_DEVICE_SYNC_SENT: return `Device: Config Sent`;
      case STATUS_DEVICE_SYNC_ACKNOWLEDGED: return `Device: Config Ack`;
      default: return `${log.status}`;
    }
  };

  if (!auth.isAuthenticated) {
      return (
          <Card className="p-4 md:p-6 shadow-md border-primary/30 text-center">
              <Info className="h-10 w-10 mx-auto text-primary mb-2" />
              <p className="text-lg">Please log in to view logs.</p>
          </Card>
      );
  }


  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-6 shadow-md border-primary/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-date-range" className="text-sm font-medium">Date Range</label>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-filter-select" className="text-sm font-medium">Filter</label>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger id="log-filter-select"><SelectValue placeholder="Select log type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_SCHEDULES}>Schedules (Client Logs for {auth.user?.email || 'current user'})</SelectItem>
                <SelectItem value={FILTER_FEEDINGS_AND_SYNC}>Device Activity (RTDB for {auth.user?.email || 'current user'})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-search-input" className="text-sm font-medium">Search Details</label>
            <div className="relative">
              <Input
                id="log-search-input"
                placeholder="Search details, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <Button onClick={resetFilters} variant="outline" className="w-full lg:col-span-3 mt-2">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
          </Button>
        </div>
      </Card>

      <div className="overflow-x-auto bg-card p-0 rounded-lg shadow-md">
        <Table>
          <TableCaption>{filteredLogs.length === 0 ? "No log entries match your filters." : `Showing ${filteredLogs.length} of ${logsRef.current.length} total log entries for ${auth.user?.email || 'this account'}.`}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Details (Info / Config / Device)</TableHead>
              <TableHead className="text-center">Status / Event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.timestamp.toLocaleString()}</TableCell>
                <TableCell>{formatLogDetails(log)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={getStatusBadgeVariant(log)} className="flex items-center justify-center gap-1.5 w-auto min-w-[200px] px-2.5 py-1 mx-auto text-xs">
                    {getStatusIcon(log)}
                    {getStatusDisplayText(log)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  {(auth.user?.email && logsRef.current.length === 0) ? `No logs found for ${sanitizeFirebaseKey(auth.user.email)}.` : "No log entries match your filters, or user not fully loaded."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

