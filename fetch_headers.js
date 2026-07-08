async function test() {
    const res = await fetch('http://127.0.0.1:8788/article/download-al_ribat-app');
    console.log('Status:', res.status);
    console.log('Headers:');
    for (const [key, val] of res.headers.entries()) {
        console.log(`${key}: ${val}`);
    }
}
test();
