interface WebNotificationResponse {
  notification: {
    request: {
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
}

export function handleNotificationResponse(_response: WebNotificationResponse) {
  // Browser notifications are handled inside useNotifications.web.ts.
}

export function getInitialNotification() {
  return;
}
