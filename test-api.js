// Test notification API response
fetch('http://localhost:5000/api/notifications/emails')
  .then(r => r.json())
  .then(data => {
    console.log('📡 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.notifications) {
      console.log('\n📊 Notification counts:');
      data.notifications.forEach(n => {
        console.log(`   ${n.leadName}: ${n.count || 1} email(s)`);
        console.log(`   IDs: ${(n.notificationIds || [n.id]).join(', ')}`);
      });
    }
  })
  .catch(err => console.error('Error:', err));
