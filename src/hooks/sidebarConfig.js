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
      // The Current Event link should not navigate directly to /admin/current-event without an ID.
      // Instead, direct to dashboard where events can be selected for monitoring.
      { label: "Current Event", to: "/admin/dashboard" },
      { label: "Roster", to: "/admin/roster" },
      { label: "Partner Hub", to: "/admin/events/partners" },
    ],
  },
  {
    key: "project",
    label: "Project",
    children: [
      { label: "Project List", to: "/admin/projects" },
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
      { label: "System Activity Log", to: "/admin/audit-logs" },
      { label: "Backup & Restore", to: "/admin/backup-restore" },
      { label: "Students Banner", to: "/admin/system/banner" },
      { label: "Announcement", to: "/admin/system/announcement" },
      { label: "Privacy & Terms", to: "/admin/system/agreements" },
      { label: "Badges", to: "/admin/system/badges" },
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
      { label: "Current Event", to: "/admin/events/current" },
      { label: "Roster", to: "/admin/roster" },
      { label: "Partner Hub", to: "/admin/events/partners" },
    ],
  },
  {
    key: "project",
    label: "Project",
    children: [
      { label: "Project List", to: "/faculty/projects" },
    ],
  },
  {
    key: "forms",
    label: "Forms",
    children: [
      { label: "Document Library", to: "/admindocuments" },
    ],
  },
];