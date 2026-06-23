// Firebase Messaging Service Worker — processa notificações em background
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDPi4irGqePrxlFv71FrVQjnAw-rcz-OW0',
  authDomain:        'longview-site-76b27.firebaseapp.com',
  projectId:         'longview-site-76b27',
  storageBucket:     'longview-site-76b27.firebasestorage.app',
  messagingSenderId: '508152637275',
  appId:             '1:508152637275:web:3a387ca11783f01f371c7e',
});

const messaging = firebase.messaging();

// Notificações recebidas quando o app está em background / fechado
messaging.onBackgroundMessage(payload => {
  const { title = 'LongView', body = '' } = payload.notification ?? {};
  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  payload.data ?? {},
    vibrate: [200, 100, 200],
  });
});

// Clique na notificação → abre o app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
