
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

const TOPIC_DETAILED_CONFIG = "iot/schedule/detailed_config";
const TOPIC_ENABLED = "iot/schedule/enabled";

const initialSchedule: ScheduleEntry | null = null;

interface CalculatedFeeding {
  time: string; // HH:MM
  amount: string; // X.XXg
}

export function ScheduleManager() {
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleEntry | null>(initialSchedule);
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const mqttContext = useMqtt();
  const auth = useAuth();

  const sanitizeFirebaseKey = (key: string): string => {
    return key.replace(/[.#$[\]]/g, '_');
  };

  const getScheduleStorageKey = (): string | null => {
    if (auth.user?.email) {
      return `${SCHEDULE_STORAGE_KEY_PREFIX}${sanitizeFirebaseKey(auth.user.email)}`;
    }
    return null;
  };

  const getClientLogStorageKey = (): string | null => {
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
        if (parsedSchedule && typeof parsedSchedule === 'object' &&
            'id' in parsedSchedule && parsedSchedule.id === auth.user.email &&
            'time' in parsedSchedule && 'frequency' in parsedSchedule &&
            'amount' in parsedSchedule && 'enabled' in parsedSchedule) {
          setCurrentSchedule(parsedSchedule as ScheduleEntry);
        } else {
          if (parsedSchedule && parsedSchedule.id !== auth.user.email) {
            console.warn(`ScheduleManager: Schedule found in localStorage for ${parsedSchedule.id} but current user is ${auth.user.email}. Clearing.`);
          }
          localStorage.removeItem(storageKey);
          setCurrentSchedule(null);
        }
      } catch (e) {
        console.warn("ScheduleManager: Error parsing schedule from localStorage for user, clearing.", e);
        localStorage.removeItem(storageKey);
        setCurrentSchedule(null);
      }
    } else {
      setCurrentSchedule(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.email]);

  useEffect(() => {
    if (!auth.user?.email) return;
    const storageKey = getScheduleStorageKey();
    if (!storageKey) return;

    if (currentSchedule && currentSchedule.id === auth.user.email) {
      localStorage.setItem(storageKey, JSON.stringify(currentSchedule));
    } else if (!currentSchedule) {
      localStorage.removeItem(storageKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchedule, auth.user?.email]);

  const addLogEntry = (logEntryData: Omit<LogEntry, 'id' | 'timestamp'>): void => {
    if (!auth.user?.email) return;
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
        currentLogs = (JSON.parse(storedLogsRaw) as LogEntry[]).map(log => ({ ...log, timestamp: new Date(log.timestamp) }));
      }
    } catch (e) { console.warn("ScheduleManager: Error parsing logs for adding new entry.", e); }

    const updatedLogs = [newLog, ...currentLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    try {
      localStorage.setItem(clientLogStorageKey, JSON.stringify(updatedLogs.slice(0, 200)));
    } catch (storageError) {
      console.error("ScheduleManager: Critical error saving logs to localStorage.", storageError);
      toast({ title: "Error Saving Log", description: "Could not save log. Storage might be full.", variant: "destructive" });
    }
  };

  const calculateDetailedFeedings = (
    firstMealTime: string, // "HH:MM"
    totalDailyAmountStr: string, // "15g"
    frequency: FeedingFrequency
  ): CalculatedFeeding[] => {
    const [h, m] = firstMealTime.split(':').map(Number);
    const firstMealDate = new Date();
    firstMealDate.setHours(h, m, 0, 0);

    const totalAmountNumeric = parseFloat(totalDailyAmountStr.replace(/g$/i, ''));
    if (isNaN(totalAmountNumeric) || totalAmountNumeric <= 0) return [];

    let numFeedings = 1;
    if (frequency === "Twice a day") numFeedings = 2;
    else if (frequency === "Thrice a day") numFeedings = 3;

    const amountPerFeedingVal = totalAmountNumeric / numFeedings;
    // Format to ensure at least one decimal place, and up to two if needed.
    const amountPerFeedingStr = `${parseFloat(amountPerFeedingVal.toFixed(2))}g`;


    const feedings: CalculatedFeeding[] = [];
    if (numFeedings === 0) return [];
    const intervalHours = 24 / numFeedings;

    for (let i = 0; i < numFeedings; i++) {
      const currentMealDate = new Date(firstMealDate.getTime());
      if (i > 0) { // Add interval for subsequent meals
          currentMealDate.setHours(currentMealDate.getHours() + i * intervalHours);
      }
      
      const hh = String(currentMealDate.getHours()).padStart(2, '0');
      const mm = String(currentMealDate.getMinutes()).padStart(2, '0');
      feedings.push({ time: `${hh}:${mm}`, amount: amountPerFeedingStr });
    }
    return feedings;
  };

  const formatDetailedScheduleToString = (feedings: CalculatedFeeding[]): string => {
    return feedings.map(f => `${f.time},${f.amount}`).join(';');
  };

  const publishToMqtt = async (topic: string, message: string): Promise<boolean> => {
     if (!mqttContext || !mqttContext.isConnected || !mqttContext.client) {
      toast({
        title: "MQTT Not Connected",
        description: `Cannot publish to ${topic}. MQTT client is not connected.`,
        variant: "destructive",
        duration: 7000,
      });
      console.error(`ScheduleManager: MQTT not connected, cannot publish to ${topic}.`);
      if (mqttContext && mqttContext.error) console.error("ScheduleManager: MQTT Connection Error:", mqttContext.error);
      return false;
    }
    console.log(`ScheduleManager: Publishing to MQTT. Topic: [${topic}], Message: ["${message}"].`);
    return await mqttContext.publish(topic, message, { qos: 1, retain: true });
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
      : (isUpdating ? currentSchedule!.enabled : true); // Default to enabled for new schedules

    const newScheduleBasis: ScheduleEntry = {
      ...scheduleData,
      id: auth.user.email,
      enabled: newEnabledState,
    };

    setCurrentSchedule(newScheduleBasis);
    addLogEntry({
      status: isUpdating ? "Schedule Updated" : "Schedule Set",
      scheduleDetails: { ...newScheduleBasis },
      deviceId: sanitizedUserEmail,
    });
    toast({
      title: isUpdating ? "Schedule Updated Locally" : "Schedule Set Locally",
      description: `Config for ${newScheduleBasis.time} (first meal), total ${newScheduleBasis.amount}/day, freq: ${newScheduleBasis.frequency}. Publishing...`,
    });

    const detailedFeedings = calculateDetailedFeedings(newScheduleBasis.time, newScheduleBasis.amount, newScheduleBasis.frequency);
    const detailedConfigString = formatDetailedScheduleToString(detailedFeedings);

    let allPublishedSuccessfully = true;
    const publishedEnabled = await publishToMqtt(TOPIC_ENABLED, String(newScheduleBasis.enabled));
    if (!publishedEnabled) allPublishedSuccessfully = false;

    // Only publish detailed config if the schedule is enabled
    if (newScheduleBasis.enabled) {
      const publishedDetailedConfig = await publishToMqtt(TOPIC_DETAILED_CONFIG, detailedConfigString);
      if (!publishedDetailedConfig) allPublishedSuccessfully = false;
    } else {
      // If schedule is being set to disabled, we might want to publish an empty detailed config or specific "disabled" signal
      // For now, let's assume not publishing detailed_config when enabled is false is sufficient if device checks enabled status first.
      // Alternatively, publish an empty string or a special marker if the device expects something on TOPIC_DETAILED_CONFIG.
      // Let's publish an empty string to clear any previous detailed config on the device if it's disabled.
      const publishedEmptyDetailedConfig = await publishToMqtt(TOPIC_DETAILED_CONFIG, "");
       if (!publishedEmptyDetailedConfig) allPublishedSuccessfully = false;
       console.log("ScheduleManager: Schedule is disabled, published empty string to TOPIC_DETAILED_CONFIG.");
    }


    addLogEntry({
      status: 'Device Sync: Config Sent',
      scheduleDetails: { ...newScheduleBasis },
      deviceId: sanitizedUserEmail,
      notes: `Enabled: ${newScheduleBasis.enabled}. Detailed: ${newScheduleBasis.enabled ? detailedConfigString : '(not sent as schedule is disabled, empty string sent)'}. Pub Success: ${allPublishedSuccessfully}.`
    });

    if (allPublishedSuccessfully) {
      toast({ title: "Schedule Sync Attempted", description: "Schedule configuration and enabled status sent via MQTT.", variant: "default" });
    } else {
      toast({ title: "Partial Schedule Sync", description: "Some schedule parts failed to publish. Check logs.", variant: "destructive" });
    }
    setIsPublishing(false);
  };

  const toggleSchedule = async (scheduleId: string) => {
    if (!auth.user?.email || !currentSchedule || currentSchedule.id !== scheduleId || currentSchedule.id !== auth.user.email) {
      toast({ title: "Error", description: "Cannot toggle schedule. Ensure you are logged in and the schedule is current.", variant: "destructive" });
      return;
    }

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
      description: `Publishing 'enabled' state (${updatedSchedule.enabled}) and detailed config via MQTT...`
    });

    const detailedFeedings = calculateDetailedFeedings(updatedSchedule.time, updatedSchedule.amount, updatedSchedule.frequency);
    const detailedConfigString = formatDetailedScheduleToString(detailedFeedings);

    let allPublishedSuccessfully = true;
    const publishedEnabled = await publishToMqtt(TOPIC_ENABLED, String(updatedSchedule.enabled));
    if (!publishedEnabled) allPublishedSuccessfully = false;

    if (updatedSchedule.enabled) {
        const publishedDetailedConfig = await publishToMqtt(TOPIC_DETAILED_CONFIG, detailedConfigString);
        if (!publishedDetailedConfig) allPublishedSuccessfully = false;
    } else {
        // Publish empty string to detailed config topic if schedule is disabled
        const publishedEmptyDetailedConfig = await publishToMqtt(TOPIC_DETAILED_CONFIG, "");
        if (!publishedEmptyDetailedConfig) allPublishedSuccessfully = false;
        console.log("ScheduleManager: Schedule toggled to disabled, published empty string to TOPIC_DETAILED_CONFIG.");
    }


    addLogEntry({
      status: 'Device Sync: Config Sent',
      scheduleDetails: { ...updatedSchedule },
      deviceId: sanitizedUserEmail,
      notes: `Toggled Enabled: ${updatedSchedule.enabled}. Detailed: ${updatedSchedule.enabled ? detailedConfigString : '(not sent as schedule is disabled, empty string sent)'}. Pub Success: ${allPublishedSuccessfully}.`
    });

    if (allPublishedSuccessfully) {
      toast({ title: "Schedule State Synced", description: `Enabled: ${updatedSchedule.enabled} and detailed config sent.`, variant: "default" });
    } else {
      toast({ title: "Partial State Sync", description: "Failed to sync some schedule parts. Check logs.", variant: "destructive" });
    }
    setIsPublishing(false);
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!auth.user?.email || !currentSchedule || currentSchedule.id !== scheduleId || currentSchedule.id !== auth.user.email) {
      toast({ title: "Error", description: "Cannot clear schedule. Ensure you are logged in and the schedule is current.", variant: "destructive" });
      return;
    }
    setIsPublishing(true);
    const scheduleBeingCleared = { ...currentSchedule };
    const sanitizedUserEmail = sanitizeFirebaseKey(auth.user.email);

    toast({ title: "Clearing Schedule...", description: "Publishing 'enabled: false' and empty detailed config, then clearing locally." });

    let allPublishedSuccessfully = true;
    const publishedEnabledFalse = await publishToMqtt(TOPIC_ENABLED, "false");
    if (!publishedEnabledFalse) allPublishedSuccessfully = false;

    const publishedEmptyDetailedConfig = await publishToMqtt(TOPIC_DETAILED_CONFIG, "");
    if (!publishedEmptyDetailedConfig) allPublishedSuccessfully = false;


    setCurrentSchedule(null); // Clear local schedule first
    addLogEntry({
      status: "Schedule Cleared",
      scheduleDetails: { ...scheduleBeingCleared },
      deviceId: sanitizedUserEmail,
    });
     addLogEntry({ // Log the sync attempt after local clear
      status: 'Device Sync: Config Sent',
      scheduleDetails: { ...scheduleBeingCleared, enabled: false },
      deviceId: sanitizedUserEmail,
      notes: `Cleared schedule. Sent Enabled: false. Sent Detailed: (empty string). Pub Success: ${allPublishedSuccessfully}.`
    });


    if (allPublishedSuccessfully) {
      toast({ title: "Schedule Clear Synced", description: "Disabled signal and empty detailed config sent to device.", variant: "default" });
    } else {
      toast({ title: "Failed to Fully Sync Clear", description: "Could not send all clear signals. Cleared locally.", variant: "destructive" });
    }
    setIsPublishing(false);
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
