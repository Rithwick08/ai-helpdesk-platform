// Dummy data for Dashboard — replace with API calls later

export const dashboardStats = [
  {
    id: 'active-incidents',
    label: 'Active Incidents',
    value: 14,
    delta: '+3 since yesterday',
    deltaType: 'negative',
    icon: 'incident',
    color: 'red',
  },
  {
    id: 'open-tickets',
    label: 'Open Tickets',
    value: 87,
    delta: '-5 from last week',
    deltaType: 'positive',
    icon: 'ticket',
    color: 'amber',
  },
  {
    id: 'threats-blocked',
    label: 'Threats Blocked',
    value: 2340,
    delta: '+128 today',
    deltaType: 'positive',
    icon: 'shield',
    color: 'green',
  },
  {
    id: 'ai-resolutions',
    label: 'AI Auto-Resolved',
    value: 61,
    delta: '74% success rate',
    deltaType: 'positive',
    icon: 'ai',
    color: 'accent',
  },
];

export const recentIncidents = [
  {
    id: 'INC-00421',
    title: 'Brute Force Attack Detected',
    severity: 'Critical',
    status: 'Open',
    source: '192.168.1.45',
    assignee: 'SOC Analyst L2',
    time: '4 min ago',
  },
  {
    id: 'INC-00420',
    title: 'Suspicious PowerShell Execution',
    severity: 'High',
    status: 'In Progress',
    source: 'WORKSTATION-07',
    assignee: 'AI Agent',
    time: '18 min ago',
  },
  {
    id: 'INC-00419',
    title: 'Unauthorized VPN Login Attempt',
    severity: 'Medium',
    status: 'Resolved',
    source: '203.0.113.17',
    assignee: 'Auto-Response',
    time: '1 hr ago',
  },
  {
    id: 'INC-00418',
    title: 'Malware Signature Match — Endpoint',
    severity: 'Critical',
    status: 'Open',
    source: 'LAPTOP-23',
    assignee: 'Unassigned',
    time: '2 hr ago',
  },
  {
    id: 'INC-00417',
    title: 'Phishing Email Campaign Detected',
    severity: 'High',
    status: 'In Progress',
    source: 'Email Gateway',
    assignee: 'SOC Analyst L1',
    time: '3 hr ago',
  },
];

export const threatFeed = [
  { id: 1, type: 'DDoS', origin: 'CN', risk: 95, timestamp: '23:18:04' },
  { id: 2, type: 'Ransomware C2', origin: 'RU', risk: 88, timestamp: '23:17:51' },
  { id: 3, type: 'Port Scan', origin: 'US', risk: 42, timestamp: '23:17:39' },
  { id: 4, type: 'SQL Injection', origin: 'BR', risk: 73, timestamp: '23:16:22' },
  { id: 5, type: 'Credential Stuffing', origin: 'NG', risk: 81, timestamp: '23:15:08' },
];

export const systemHealth = [
  { name: 'Firewall', status: 'Operational', uptime: '99.98%' },
  { name: 'IDS/IPS', status: 'Operational', uptime: '99.95%' },
  { name: 'SIEM', status: 'Degraded', uptime: '97.20%' },
  { name: 'EDR Agent', status: 'Operational', uptime: '99.99%' },
  { name: 'Email Gateway', status: 'Operational', uptime: '100%' },
  { name: 'VPN Gateway', status: 'Maintenance', uptime: '85.00%' },
];

export const aiActivityLog = [
  { id: 1, action: 'Auto-blocked IP 203.0.113.17 after 5 failed SSH attempts', time: '23:17', type: 'block' },
  { id: 2, action: 'Password reset ticket #5823 resolved via self-service AI', time: '23:12', type: 'resolve' },
  { id: 3, action: 'Phishing URL quarantined from user inbox — hr@corp.com', time: '23:09', type: 'quarantine' },
  { id: 4, action: 'Anomalous login from new geo-location flagged for review', time: '23:01', type: 'flag' },
  { id: 5, action: 'Patch deployment initiated on 12 endpoints (CVE-2025-1234)', time: '22:54', type: 'patch' },
];
