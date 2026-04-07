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
      { label: "Program Impact Metrics", to: "/admin/dashboard/metrics" },
      { label: "SDG", to: "/admin/dashboard/sdg" },
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
      { label: "Project List", to: "/admin/projects" },
      { label: "Review Proposals", to: "/admin/review-proposals" },
      { label: "Badge & Points", to: "/admin/projects/badges" },
    ],
  },
  {
    key: "forms",
    label: "Forms",
    children: [
      { label: "Document Library", to: "/admin/documents" },
    ],
  },
  {
    key: "system",
    label: "System",
    children: [
      { label: "Volunteers Banner", to: "/admin/system/banner" },
      { label: "Announcement", to: "/admin/system/announcement" },
      { label: "Badges", to: "/admin/system/badges" },
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
    key: "project",
    label: "Project",
    children: [
      { label: "Project List", to: "/faculty/projects" },
      { label: "Review Proposals", to: "/global/review-proposals" },
    ],
  },
];