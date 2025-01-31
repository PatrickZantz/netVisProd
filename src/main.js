let network;
let model;
const similarityCache = new Map();

// Laden des BERT-Modells
async function loadBERTModel() {
  try {
    if (!model) {
      model = await use.load();
    }
    return model;
  } catch (error) {
    console.error("Fehler beim Laden des BERT-Modells:", error);
    throw new Error("BERT-Modell konnte nicht geladen werden.");
  }
}

// Berechnung der Ähnlichkeit mit Caching
async function calculateSimilarity(text1, text2) {
  try {
    const cacheKey = `${text1}|${text2}`;
    if (similarityCache.has(cacheKey)) {
      return similarityCache.get(cacheKey);
    }
    const embeddings = await model.embed([text1, text2]);
    const similarity =
      1 -
      tf.losses
        .cosineDistance(
          embeddings.slice([0, 0], [1]),
          embeddings.slice([1, 0], [1])
        )
        .dataSync()[0];
    similarityCache.set(cacheKey, similarity);
    return similarity;
  } catch (error) {
    console.error("Fehler bei der Ähnlichkeitsberechnung:", error);
    return 0; // Rückgabe von 0 als Fallback bei Fehler
  }
}

// Optimierte Ähnlichkeitsanalyse mit Batch-Verarbeitung
async function analyzeSimilarity(terms, threshold) {
  try {
    model = await loadBERTModel();
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();

    terms.forEach((term, index) => {
      nodes.add({ id: index, label: term });
    });

    const batchSize = 100;
    const totalComparisons = (terms.length * (terms.length - 1)) / 2;
    let completedComparisons = 0;

    for (let i = 0; i < terms.length; i += batchSize) {
      const batch = terms.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (term, batchIndex) => {
          const globalIndex = i + batchIndex;
          for (let j = globalIndex + 1; j < terms.length; j++) {
            const sim = await calculateSimilarity(term, terms[j]);
            if (sim > threshold) {
              edges.add({ from: globalIndex, to: j });
            }
            completedComparisons++;
            updateProgress((completedComparisons / totalComparisons) * 100);
          }
        })
      );
    }

    return { nodes, edges };
  } catch (error) {
    console.error("Fehler bei der Ähnlichkeitsanalyse:", error);
    throw new Error("Ähnlichkeitsanalyse konnte nicht durchgeführt werden.");
  }
}

// Aktualisierung des Netzwerks
function updateNetwork(nodes, edges) {
  try {
    const container = document.getElementById("network");
    const data = { nodes, edges };
    const options = {
      physics: {
        enabled: document.getElementById("physics-toggle").checked,
      },
    };
    network = new vis.Network(container, data, options);
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Netzwerks:", error);
    alert("Netzwerk konnte nicht aktualisiert werden.");
  }
}

// Funktion zum Anzeigen des Loadingscreens
function showLoadingScreen() {
  document.getElementById("loading-overlay").classList.remove("hidden");
}

// Funktion zum Ausblenden des Loadingscreens
function hideLoadingScreen() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

// Aktualisierung des Fortschrittsbalkens
function updateProgress(percentage) {
  try {
    document.getElementById(
      "loading-message"
    ).textContent = `Analysiere... ${Math.round(percentage)}%`;
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Fortschritts:", error);
  }
}

// Event-Listener für Datei-Upload
document
  .getElementById("file-input")
  .addEventListener("change", async function (event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      showLoadingScreen();

      const reader = new FileReader();
      reader.onload = async function (e) {
        try {
          const content = e.target.result;
          const terms = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          const threshold = parseFloat(
            document.getElementById("similarity-slider").value
          );

          const result = await analyzeSimilarity(terms, threshold);
          updateNetwork(result.nodes, result.edges);
        } catch (error) {
          console.error("Fehler bei der Verarbeitung der Datei:", error);
          alert("Datei konnte nicht verarbeitet werden.");
        } finally {
          hideLoadingScreen();
        }
      };
      reader.onerror = function (error) {
        console.error("Fehler beim Lesen der Datei:", error);
        alert("Datei konnte nicht gelesen werden.");
        hideLoadingScreen();
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Fehler beim Datei-Upload:", error);
      alert("Datei-Upload fehlgeschlagen.");
      hideLoadingScreen();
    }
  });

// Der Rest des Codes bleibt unverändert
