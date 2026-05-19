//icons
import {
  HomeRoundedIcon,
  ListAltIcon,
  DesignServicesOutlinedIcon,
  SettingsOutlinedIcon,
} from "../components/icons/index";

//admin side
export const adminLinks = [
  {
    key: "dashboard",
    label: "Dashboard",
    children: [
      { label: "Overview", to: "/admin/dashboard" },
    ],
  },
  {
    key: "events",
    label: "Events",
    children: [
      { label: "Current Event", to: "/admin/current-event" },
      { label: "Roster", to: "/admin/roster" },
      { label: "Partner Hub", to: "/admin/events/partners" },
    ],
  },
  {
    key: "project",
    label: "Project",
    children: [
      { label: "Project Proposals", to: "/admin/review-proposals" },
      { label: "Badges", to: "/admin/system/badges" },
    ],
  },
  {
    key: "system",
    label: "System",
    children: [
      { label: "Announcements", to: "/admin/system/announcements" },
      { label: "Audit Logs", to: "/admin/audit-logs" },
    ],
  },
];

// system admin side
export const sysadminLinks = [
  {
    key: "roster",
    label: "Roster",
    children: [
      { label: "Account Management", to: "/sysadmin/roster" },
    ],
  },
  {
    key: "system",
    label: "System",
    children: [
      { label: "Support Inbox", to: "/sysadmin/support" },
      { label: "Privacy & Terms", to: "/sysadmin/system/agreements" },
      { label: "Activity Log", to: "/sysadmin/audit-logs" },
      { label: "Backup & Restore", to: "/sysadmin/backup-restore" },
    ],
  },
];

//partner side
export const partnerLinks = [
  {
    key: "project",
    label: "Project",
    children: [
      { label: "Project List", to: "/partner/projects" },
    ],
  },
];

//faculty side
export const facultyLinks = [
  {
    key: "events",
    label: "Events",
    children: [
      { label: "Current Event", to: "/faculty/current-event" },
    ],
  },
  {
    key: "project",
    label: "Project",
    children: [
      { label: "Review Proposals", to: "/faculty/review-proposals" },
    ],
  },
];