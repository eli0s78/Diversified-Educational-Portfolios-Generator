const requestBody = { papers: [{ id: "1", title: "Test Paper", abstract: "This is a test abstract." }] };
fetch("http://localhost:3000/api/topic-modeling", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
}).then(r => r.json()).then(data => {
    console.log("SERVER RETURNED:", data);
}).catch(console.error);
