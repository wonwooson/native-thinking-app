fetch('https://native-thinking-app.onrender.com/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sentences: ["Test debug API call."], isLink: false })
}).then(res => res.json()).then(console.log).catch(console.error);
