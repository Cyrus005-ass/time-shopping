(() => {
  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds };
  }

  function formatCountdown(ms) {
    const { hours, minutes, seconds } = formatDuration(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function isExpired(targetDate) {
    return targetDate instanceof Date && targetDate.getTime() <= Date.now();
  }

  window.SDChrono = {
    parseDate,
    addHours,
    formatDuration,
    formatCountdown,
    isExpired
  };
})();