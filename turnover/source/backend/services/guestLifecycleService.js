function archiveCutoff(now, archiveDays) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - archiveDays);
  return cutoff.toISOString();
}

export function createGuestLifecycleService({ userModel, guestArchiveDays = 30, now = () => new Date() }) {
  return {
    async archiveOnLogout(user) {
      if (user?.accountType !== 'guest') return null;
      return userModel.archiveGuest(user.id);
    },
    async archiveExpiredGuests() {
      return userModel.archiveExpiredGuests(archiveCutoff(now(), guestArchiveDays));
    },
  };
}
