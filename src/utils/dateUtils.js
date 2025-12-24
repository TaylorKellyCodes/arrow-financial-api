function parseDateToUtc(dateStr) {
  // Expect DD/MM/YYYY
  const [day, month, year] = dateStr.split("/").map((v) => parseInt(v, 10));
  if (!day || !month || !year) return null;
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate;
}

function formatDateFromUtc(date) {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = { parseDateToUtc, formatDateFromUtc };

