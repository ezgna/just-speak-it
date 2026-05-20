type PracticeRefreshListener = () => void;

const practiceRefreshListeners = new Set<PracticeRefreshListener>();

export function subscribeToPracticeRefresh(listener: PracticeRefreshListener) {
  practiceRefreshListeners.add(listener);

  return () => {
    practiceRefreshListeners.delete(listener);
  };
}

export function notifyPracticeChanged() {
  for (const listener of practiceRefreshListeners) {
    listener();
  }
}
