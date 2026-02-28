export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initApp } = await import("./lib/init");
    initApp();
  }
}
