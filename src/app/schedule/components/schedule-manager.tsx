
"use client";

import type { ScheduleEntry, LogEntry, FeedingFrequency } from "@/lib/types";
import { useState, useEffect } from "react";
import { ScheduleForm } from "./schedule-form";
import { ScheduleList } from "./schedule-list";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useMqtt } from "@/contexts/mqtt-context";
import { useAuth } from "@/contexts/auth-context"; 

const LOG_STORAGE_KEY_PREFIX = "aquafeed-logs-client-";
const SCHEDULE_STORAGE_KEY_PREFIX = "aquafeed-current-schedule-";


const TOPIC_TIME = "iot/schedule/time";
const TOPIC_FREQUENCY = "iot/schedule/frequency";
const TOPIC_AMOUNT = "iot/schedule/amount";
const TOPIC_ENABLED = "iot/schedule/enabled";

const initialSchedule: ScheduleEntry | null = null;

export function ScheduleManager() {
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleEntry | null>(initialSchedule);
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const mqttContext = useMqtt();
  const auth = useAuth(); 

  const sanitizeFirebaseKey = (key: string) => {
    return key.replace(/[.#$[\]]/g, '_');
  };

  const getScheduleStorageKey = () => {
    if (auth.user?.email) {
      return `${SCHEDULE_STORAGE_KEY_PREFIX}${sanitizeFirebaseKey(auth.user.email)}`;
    }
    return null;
  };
  
  const getClientLogStorageKey = () => {
    if (auth.user?.email) {
      return `${LOG_STORAGE_KEY_PREFIX}${sanitizeFirebaseKey(auth.user.email)}`;
    }
    return null;
  };

  useEffect(() => {
    if (!auth.user?.email) {
        setCurrentSchedule(null);
        return;
    }
    const storageKey = getScheduleStorageKey();
    if (!storageKey) return;

    const storedSchedule = localStorage.getItem(storageKey);
    if (storedSchedule) {
      try {
        const parsedSchedule = JSON.parse(storedSchedule);
        if (parsedSchedule &&
            typeof parsedSchedule === 'object' &&
            'id' in parsedSchedule &&
            parsedSchedule.id === auth.user.email && // Ensure it's for the current user
            'time' in parsedSchedule &&
            'frequency' in parsedSchedule &&
            'amount' in parsedSchedule &&
            'enabled' in parsedSchedule) {
          setCurrentSchedule(parsedSchedule as ScheduleEntry);
        } else {
          localStorage.removeItem(storageKey);
          setCurrentSchedule(null);
        }
      } catch (e) {
        console.warn("ScheduleManager: Error parsing schedule from localStorage for user, clearing.", e);
        localStorage.removeItem(storageKey);
        setCurrentSchedule(null);
      }
    } else {
        setCurrentSchedule(null); // No schedule found for this user
    }
  }, [auth.user?.email]);

  useEffect(() => {
    if (!auth.user?.email) return;
    const storageKey = getScheduleStorageKey();
    if (!storageKey) return;

    if (currentSchedule && currentSchedule.id === auth.user.email) {
      localStorage.setItem(storageKey, JSON.stringify(currentSchedule));
    } else if (!currentSchedule) { // If currentSchedule becomes null (e.g. cleared)
      localStorage.removeItem(storageKey);
    }
  }, [currentSchedule, auth.user?.email]);

  const addLogEntry = (logEntryData: Omit<LogEntry, 'id' | 'timestamp'>) => {
    if (!auth.user?.email) return; // Don't log if no user
    
    const clientLogStorageKey = getClientLogStorageKey();
    if (!clientLogStorageKey) return;

    const sanitizedUserEmail = sanitizeFirebaseKey(auth.user.email);
    const newLog: LogEntry = {
      ...logEntryData,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      deviceId: logEntryData.deviceId || sanitizedUserEmail, 
    };

    let currentLogs: LogEntry[] = [];
    try {
      const storedLogsRaw = localStorage.getItem(clientLogStorageKey);
      if (storedLogsRaw) {
        const parsedStoredLogs = JSON.parse(storedLogsRaw);
        if (Array.isArray(parsedStoredLogs)) {
          currentLogs = parsedStoredLogs.map((log: any) => {
            if (log && typeof log === 'object' && log.timestamp && typeof log.id === 'string' && typeof log.status === 'string') {
              return { ...log, timestamp: new Date(log.timestamp) };
            }
            return null;
          }).filter(log => log !== null) as LogEntry[];
        }
      }
    } catch (e) {
      console.warn("ScheduleManager: Error parsing logs from localStorage for adding new entry.", e);
    }

    const updatedLogs = [newLog, ...currentLogs];
    updatedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    try {
      localStorage.setItem(clientLogStorageKey, JSON.stringify(updatedLogs));
    } catch (storageError) {
      console.error("ScheduleManager: Critical error saving logs to localStorage.", storageError);
      toast({
        title: "Error Saving Log",
        description: "Could not save log to local storage. Storage might be full.",
        variant: "destructive",
      });
    }
  };

  const publishScheduleComponentToMqtt = async (
    topic: string,
    partName: 'time' | 'frequency' | 'amount' | 'enabled',
    rawValue: string | boolean | number
  ): Promise<boolean> => {
    if (!mqttContext || !mqttContext.isConnected || !mqttContext.client) {
      toast({
        title: "MQTT Not Connected",
        description: `Cannot publish component '${partName}'. MQTT client is not connected.`,
        variant: "destructive",
        duration: 7000,
      });
      console.error("ScheduleManager: MQTT not connected, cannot publish component:", partName);
      if (mqttContext && mqttContext.error) console.error("ScheduleManager: MQTT Connection Error:", mqttContext.error);
      return false;
    }

    const accountId = auth.user?.email || "unknown_user_schedule_publish";
    const sanitizedAccountId = sanitizeFirebaseKey(accountId);
    
    const message: string = String(rawValue); // Ensure plain text
    
    console.log(`ScheduleManager: Publishing PLAIN TEXT to MQTT. Topic: [${topic}], Part: [${partName}], Value: ["${message}"]. Intended for account (raw): ${accountId}, (sanitized for RTDB): ${sanitizedAccountId}`);

    // For plain text, the `targetDeviceId` is not sent in the payload itself.
    // The association to the user for RTDB logging on the Cloud Function side (if it were to process plain text)
    // would need to be inferred or handled differently.
    // For now, this function is primarily about sending the plain value to the device.
    // The device (ESP32) needs to know how to interpret this plain text.
    // If the device needs to ACK back to a specific user, it would need to receive the user's ID
    // perhaps through a JSON command earlier, or the universal topics are implicitly for one user per device.

    const success = await mqttContext.publish(topic, message, { qos: 1, retain: true });

    if (success) {
      console.log(`ScheduleManager: Successfully published PLAIN TEXT for ${partName} ("${message}") to MQTT topic ${topic}.`);
      
      const scheduleDetailsForLog = currentSchedule 
        ? { ...currentSchedule, enabled: partName === 'enabled' ? (rawValue as boolean) : currentSchedule.enabled } 
        : { time: "", frequency: "" as FeedingFrequency, amount: "", enabled: false};

      if (partName === 'time') scheduleDetailsForLog.time = rawValue as string;
      else if (partName === 'frequency') scheduleDetailsForLog.frequency = rawValue as FeedingFrequency;
      else if (partName === 'amount') scheduleDetailsForLog.amount = rawValue as string;
      else if (partName === 'enabled') scheduleDetailsForLog.enabled = rawValue as boolean;
      
      addLogEntry({
        status: 'Device Sync: Config Sent',
        scheduleDetails: scheduleDetailsForLog,
        deviceId: sanitizedAccountId, 
        notes: `Published ${partName}: "${message}" (plain text) to ${topic}`
      });
    } else {
      console.error(`ScheduleManager: Failed to publish PLAIN TEXT for ${partName} to MQTT topic ${topic}.`);
      toast({ title: "MQTT Publish Error", description: `Sending ${partName} to ${topic} failed.`, variant: "destructive" });
    }
    return success;
  };


  const handleSaveSchedule = async (scheduleData: Omit<ScheduleEntry, 'id' | 'enabled'> & { enabled?: boolean }) => {
    if (!auth.user?.email) {
      toast({ title: "Authentication Error", description: "You must be logged in to save a schedule.", variant: "destructive" });
      return;
    }
    setIsPublishing(true);
    const sanitizedUserEmail = sanitizeFirebaseKey(auth.user.email);

    const isUpdating = !!currentSchedule && currentSchedule.id === auth.user.email;
    const newEnabledState = scheduleData.enabled !== undefined
      ? scheduleData.enabled
      : (isUpdating ? currentSchedule!.enabled : true);

    const newSchedule: ScheduleEntry = {
      ...scheduleData,
      id: auth.user.email, // Use raw user email as schedule ID locally
      enabled: newEnabledState,
    };
    
    setCurrentSchedule(newSchedule); 
    addLogEntry({
      status: isUpdating ? "Schedule Updated" : "Schedule Set",
      scheduleDetails: { ...newSchedule },
      deviceId: sanitizedUserEmail,
    });
    toast({
      title: isUpdating ? "Schedule Updated Locally" : "Schedule Set Locally",
      description: `Config for ${newSchedule.time} is now ${newSchedule.enabled ? 'active' : 'inactive'}. Publishing components...`,
    });
    
    const publishOperations = [
      { topic: TOPIC_TIME, part: 'time' as const, value: newSchedule.time },
      { topic: TOPIC_FREQUENCY, part: 'frequency' as const, value: newSchedule.frequency },
      { topic: TOPIC_AMOUNT, part: 'amount' as const, value: newSchedule.amount },
      { topic: TOPIC_ENABLED, part: 'enabled' as const, value: newSchedule.enabled },
    ];

    let allPublishedSuccessfully = true;
    for (const op of publishOperations) {
      const success = await publishScheduleComponentToMqtt(op.topic, op.part, op.value);
      if (!success) {
        allPublishedSuccessfully = false;
      }
    }

    if (allPublishedSuccessfully) {
        toast({
            title: "Schedule Components Published",
            description: "Schedule components sent as plain text via MQTT.",
            variant: "default"
        });
    } else {
        toast({
            title: "Partial Component Publish",
            description: "Some schedule components failed to publish. Check logs.",
            variant: "destructive"
        });
    }
    setIsPublishing(false);
  };

  const toggleSchedule = async (scheduleId: string) => {
    if (!auth.user?.email) {
      toast({ title: "Authentication Error", description: "You must be logged in to toggle a schedule.", variant: "destructive" });
      return;
    }
    if (currentSchedule && currentSchedule.id === scheduleId && currentSchedule.id === auth.user.email) {
      setIsPublishing(true);
      const updatedSchedule = { ...currentSchedule, enabled: !currentSchedule.enabled };
      const sanitizedUserEmail = sanitizeFirebaseKey(auth.user.email);
      
      setCurrentSchedule(updatedSchedule);
      addLogEntry({
        status: "Schedule Updated",
        scheduleDetails: { ...updatedSchedule },
        deviceId: sanitizedUserEmail,
      });
      toast({
        title: `Schedule ${updatedSchedule.enabled ? 'Enabled' : 'Disabled'} Locally`,
        description: `Publishing 'enabled' state (${updatedSchedule.enabled.toString()}) as plain text via MQTT...`
      });

      const success = await publishScheduleComponentToMqtt(TOPIC_ENABLED, 'enabled', updatedSchedule.enabled);

      if (success) {
          toast({
              title: "Enabled State Published",
              description: `Schedule 'enabled: ${updatedSchedule.enabled.toString()}' (plain text) sent to ${TOPIC_ENABLED}.`,
              variant: "default"
          });
      }
      setIsPublishing(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!auth.user?.email) {
      toast({ title: "Authentication Error", description: "You must be logged in to delete a schedule.", variant: "destructive" });
      return;
    }
    if (currentSchedule && currentSchedule.id === scheduleId && currentSchedule.id === auth.user.email) {
      setIsPublishing(true);
      const scheduleBeingCleared = { ...currentSchedule }; 
      const sanitizedUserEmail = sanitizeFirebaseKey(auth.user.email);

      toast({ title: "Clearing Schedule...", description: "Publishing 'enabled: false' (plain text) then clearing locally." });

      const publishDisabledSuccess = await publishScheduleComponentToMqtt(TOPIC_ENABLED, 'enabled', false);
      
      if (publishDisabledSuccess) {
        toast({ title: "Clear Signal Published", description: `Published 'enabled: false' (plain text) to ${TOPIC_ENABLED}.` });
      } else {
        toast({ title: "Failed to Publish Clear Signal", description: `Could not send 'enabled: false'. Clearing locally.`, variant: "destructive" });
      }
      
      setCurrentSchedule(null); 
      addLogEntry({
        status: "Schedule Cleared",
        scheduleDetails: { ...scheduleBeingCleared }, 
        deviceId: sanitizedUserEmail,
      });
      toast({
        title: "Schedule Cleared Locally",
        description: `Active schedule for ${auth.user.email} cleared.`,
      });
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8">
      <ScheduleForm
        currentSchedule={currentSchedule}
        onSaveSchedule={handleSaveSchedule}
      />
      <ScheduleList
        currentSchedule={currentSchedule}
        onToggleSchedule={toggleSchedule}
      />
      <div className="flex flex-col md:flex-row gap-2 mt-4">
        {currentSchedule && (
          <Button
            onClick={() => currentSchedule && deleteSchedule(currentSchedule.id)}
            variant="outline"
            className="w-full md:w-auto"
            disabled={isPublishing || !auth.user?.email}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isPublishing ? "Processing..." : "Clear Active Schedule"}
          </Button>
        )}
      </div>
       {mqttContext && !mqttContext.isConnected && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm">
          MQTT Client is not connected. Publishing will fail. {mqttContext.error && `Error: ${mqttContext.error}`}
        </div>
      )}
       {!auth.user?.email && (
         <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-600 text-yellow-700 rounded-md text-sm">
           Please log in to manage schedules.
         </div>
       )}
    </div>
  );
}
