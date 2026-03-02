fetch('https://native-thinking-app.onrender.com/api/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: "Test debug parse text call." })
}).then(res => res.json()).then(console.log).catch(console.error);
