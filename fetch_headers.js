async function test() {
    const res = await fetch('https://mostafayasser.online/article/invalid-slug-abcdefg-123');
    console.log('Status:', res.status);
    console.log('Headers:');
    for (const [key, val] of res.headers.entries()) {
        console.log(`${key}: ${val}`);
    }
}
test();
