# Overdue milestone notifications

CLI-generated migration 20261031065919 adds partial due-date indexes and replaces the notification_command function after 006/007. It adds in-app overdue milestone reminders for active explicit project managers on planned/active/paused projects. Client/contributor/viewer identities do not receive these manager reminders. Current project_permission is checked before enqueue and again at inbox delivery/read; revoked/disabled managers lose access. No email or external delivery is introduced.

The finite notifications:dispatch scan processes up to 500 overdue assigned-task reminders and 500 overdue milestone/manager reminders per invocation, then dispatches at most 50 eligible outbox rows. Unique user/event/day keys deduplicate repeated scans in a UTC day. Completed/cancelled milestones are excluded. Overdue preference controls both task and milestone reminders. Preferences suppress future delivery; historical events retain their original event time.

The existing Projects inbox and Overdue tasks and milestones preference expose this workflow. Native fixtures verify two managers, daily deduplication, meaningful milestone titles, completion filtering, opt-out and revoked membership. These fixtures do not prove hosted cron delivery. Install/verify 20261031065919 in approved isolated staging before rollout; no hosted function was replaced here. Manifest checksum and explicit dependency order include this migration. Rollback by stopping the scheduler and forward-fixing function behavior, without deleting outbox/history or rerunning bootstrap.

Index creation takes ordinary PostgreSQL index-build locks; measure staging size/duration and plan a production-safe installation separately. No performance SLA is inferred from small fixtures.
