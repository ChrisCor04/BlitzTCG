document.getElementById("addCardButton").addEventListener("click", async () => {
    const targetSetName = document.getElementById("cardIdInput").value.trim();
    const targetGame = "Pokemon";

    try {
        const response = await fetch(`/get-set-id?setName=${encodeURIComponent(targetSetName)}&gameName=${encodeURIComponent(targetGame)}`);
        const data = await response.json();

        if (data.setId) {
            console.log("Set ID:", data.setId);
            // Continue with next steps here...
        } else {
            console.log("Error:", data.error);
        }
    } catch (err) {
        console.error(err);
    }
});

