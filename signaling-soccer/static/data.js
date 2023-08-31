const wsConnection = new WebSocket('ws:127.0.0.1:8081', 'json');
wsConnection.onopen = (e) => {
    console.log(`wsConnection open to 127.0.0.1:8081`, e);
};
wsConnection.onerror = (e) => {
    console.error(`wsConnection error `, e);
};
wsConnection.onmessage = (e) => {
    console.log(JSON.parse(e.data));
};