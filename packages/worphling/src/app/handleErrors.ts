export function handleErrors(error: unknown) {
    if (error instanceof Error) {
        console.error("Error:", error.message);
    }
}
