export type ActivityType = 'dinner' | 'sports' | 'errands' | 'travel' | 'movie' | 'hangout' | 'other';

export interface Activity {
  id: string;
  memberName: string;
  type: ActivityType;
  description: string;
  timestamp: string;
}

export const activityConfig: Record<ActivityType, { emoji: string; label: string; color: string }> = {
  dinner: { emoji: '🍽️', label: 'Dinner Out', color: 'bg-orange-100 text-orange-700' },
  sports: { emoji: '🏃', label: 'Sports', color: 'bg-green-100 text-green-700' },
  errands: { emoji: '🛒', label: 'Errands', color: 'bg-blue-100 text-blue-700' },
  travel: { emoji: '✈️', label: 'Travel', color: 'bg-purple-100 text-purple-700' },
  movie: { emoji: '🎬', label: 'Movie', color: 'bg-pink-100 text-pink-700' },
  hangout: { emoji: '☕', label: 'Hangout', color: 'bg-yellow-100 text-yellow-700' },
  other: { emoji: '📌', label: 'Other', color: 'bg-muted text-muted-foreground' },
};

const STORAGE_KEY = 'family-activities';

export function getActivities(): Activity[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addActivity(activity: Omit<Activity, 'id' | 'timestamp'>): Activity {
  const activities = getActivities();
  const newActivity: Activity = {
    ...activity,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  activities.unshift(newActivity);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  return newActivity;
}

export function deleteActivity(id: string) {
  const activities = getActivities().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}
