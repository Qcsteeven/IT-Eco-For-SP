export async function buildContestEmbeddingText(contest: any): Promise<string> {
  const start = new Date(contest.startTimeSeconds * 1000);
  const durationMinutes = Math.floor(contest.durationSeconds / 60);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  let durationStr = '';
  if (durationHours > 0) {
    durationStr += `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
    if (remainingMinutes > 0) {
      durationStr += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  } else {
    durationStr = `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;
  }

  const startDate = start.toISOString().split('T')[0];
  const startTimeUTC = start.toISOString().slice(11, 16);

  return [
    contest.name || 'Untitled Contest',
    `Platform: Codeforces`,
    `Type: ${contest.type || 'Unknown'}`,
    `Start date: ${startDate}`,
    `Start time UTC: ${startTimeUTC}`,
    `Duration: ${durationStr}`,
    `Status: upcoming`
  ].join(' | ');
}