export const CATEGORIES = [
  {
    id: 'Pothole',
    label: 'Pothole',
    icon: 'car-outline',
    description: 'Dangerous holes, cracks, or craters in road surface',
  },
  {
    id: 'Broken Streetlight',
    label: 'Broken Streetlight',
    icon: 'bulb-outline',
    description: 'Non-functioning or flickering street lamps and poles',
  },
  {
    id: 'Garbage',
    label: 'Garbage',
    icon: 'trash-outline',
    description: 'Overflowing dumpsters, roadside litter, or illegal dumping',
  },
  {
    id: 'Water Leakage',
    label: 'Water Leakage',
    icon: 'water-outline',
    description: 'Burst pipelines, drinking water wastage, or leaking mains',
  },
  {
    id: 'Drainage',
    label: 'Drainage',
    icon: 'warning-outline',
    description: 'Clogged storm drains, overflowing sewage, or stagnant water',
  },
  {
    id: 'Road Damage',
    label: 'Road Damage',
    icon: 'construct-outline',
    description: 'Broken sidewalks, missing manhole covers, or cave-ins',
  },
  {
    id: 'Other',
    label: 'Other',
    icon: 'alert-circle-outline',
    description: 'General public infrastructure issues not listed above',
  },
];

export const STATUSES = [
  {
    id: 'Reported',
    label: 'Reported',
    icon: 'flag-outline',
    description: 'Submitted by citizen and logged in database',
  },
  {
    id: 'Under Review',
    label: 'Under Review',
    icon: 'eye-outline',
    description: 'Being inspected by municipal administrators',
  },
  {
    id: 'In Progress',
    label: 'In Progress',
    icon: 'construct-outline',
    description: 'Under active repair by field crew',
  },
  {
    id: 'Resolved',
    label: 'Resolved',
    icon: 'checkmark-circle-outline',
    description: 'Issue has been repaired and marked resolved',
  },
];

export const URGENCY_LEVELS = [
  {
    id: 'Normal',
    label: 'Normal',
    description: 'Standard civic repair queue',
  },
  {
    id: 'High',
    label: 'High',
    description: 'Safety hazard needing prompt review (subject to admin confirmation)',
  },
];

export const DISTANCE_FILTERS_KM = [1, 3, 5];

export const normalizeStatusLabel = (status) => {
  if (!status || status === 'Pending') return 'Reported';
  return status;
};
