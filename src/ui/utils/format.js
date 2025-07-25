// Date and duration formatting helpers
export function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}
 
export function formatDuration(duration) {
  return `${Math.round(duration / 1000)}s`;
} 