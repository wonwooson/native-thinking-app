const http = require('http');

const data = JSON.stringify({
    text: "Transcriber: Joseph Geni Reviewer: Morton Bast When I was 27 years old, I left a very demanding job in management consulting for a job that was even more demanding: teaching. I went to teach seventh graders math in the New York City public schools. And like any teacher, I made quizzes and tests. I gave out homework assignments. When the work came back, I calculated grades. What struck me was that IQ was not the only difference between my best and my worst students. Some of my strongest performers did not have stratospheric IQ scores. Some of my smartest kids weren't doing so well. And that got me thinking. The kinds of things you need to learn in seventh grade math, sure, they're hard: ratios, decimals, the area of a parallelogram. But these concepts are not impossible, and I was firmly convinced that every one of my students could learn the material if they worked hard and long enough. After several more years of teaching, I came to the conclusion that what we need in education is a much better understanding of students and learning from a motivational perspective, from a psychological perspective."
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/format-paragraphs',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(JSON.stringify(JSON.parse(body), null, 2)));
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
