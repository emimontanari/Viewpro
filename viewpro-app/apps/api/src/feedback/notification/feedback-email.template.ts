import type { FeedbackNotification } from "./feedback-notifier.port";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

export function renderFeedbackEmail(input: FeedbackNotification) {
	const fields = [
		["Type", input.type], ["Description", input.description], ["Pathname", input.pathname],
		["Created at", input.createdAt.toISOString()], ["Report ID", input.reportId], ["User ID", input.userId],
		["Tenant ID", input.tenantId], ["Request ID", input.requestId], ["User email", input.userEmail], ["Tenant name", input.tenantName],
	].filter((field): field is [string, string] => Boolean(field[1]));
	return {
		subject: `New feedback: ${input.type}`,
		html: `<!doctype html><html><body>${fields.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}</body></html>`,
		text: fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
	};
}
