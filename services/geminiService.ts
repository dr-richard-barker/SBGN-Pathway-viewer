import { GoogleGenAI } from "@google/genai";
import { type VisualizationConfig } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generatePathwaySvg(geneData: string, compoundData: string | null, config: VisualizationConfig): Promise<string> {
  const prompt = `
You are an expert bioinformatics visualization tool that emulates the functionality of the R 'SBGNview' library. Your task is to generate a Systems Biology Graphical Notation (SBGN) pathway map in SVG format based on the provided gene expression data, optional compound abundance data, and visualization parameters.

**Instructions:**
1.  Analyze the provided omics data. The data has been pre-summarized to include the most statistically significant entries. The first column is the identifier.
2.  Identify the specified pathway for the given species.
3.  Map the data onto the corresponding glyphs in the pathway.
4.  Color or modify the glyphs based on the data.
    -   For gene data of type 'Log2 Fold Change' or compound data of type 'fold_change', use a divergent color scale (e.g., blue for downregulated, red for upregulated).
    -   For gene data of type 'Normalized Counts' or compound data of type 'abundance', use a sequential color gradient (e.g., light yellow to dark purple for genes, light green to dark teal for compounds). Use distinct color palettes for genes and compounds.
5.  **Crucially for interactivity, add an 'id' attribute to the main SVG group ('<g>') for each glyph representing a gene or compound. The ID must be formatted as 'glyph-TYPE-IDENTIFIER', where TYPE is 'gene' or 'compound', and IDENTIFIER is the unique ID from the input data (e.g., 'glyph-gene-CDC20', 'glyph-compound-C00031'). This is essential.**
6.  Generate a single, complete, and valid SVG string representing the pathway map. The SVG must be visually appealing and clear.
7.  Adhere strictly to the visualization parameters provided below.
8.  The SVG should have a light background (e.g., #f0f0f0) to contrast with the dark app theme.

**Gene Expression Data (summarized, CSV/TSV format):**
\`\`\`
${geneData}
\`\`\`
${compoundData ? `
**Compound Abundance Data (summarized, CSV/TSV format):**
\`\`\`
${compoundData}
\`\`\`
` : ''}

**Parameters:**
*   **Species Database ID:** ${config.speciesDbId} (Refer to Reactome species IDs)
*   **Pathway ID:** ${config.pathwayId}
*   **Gene Data Type:** ${config.dataType}
*   **Gene ID Type:** ${config.geneIdType}
${compoundData ? `*   **Compound Data Type:** ${config.compoundDataType}` : ''}
${compoundData ? `*   **Compound ID Type:** ${config.compoundIdType}` : ''}
*   **Glyph Font Size:** ${config.glyphFontSize}px
*   **Default Glyph Fill Color:** ${config.glyphFillColor} (Use this for glyphs with no corresponding data)
*   **Arc (Edge) Line Width:** ${config.arcLineWidth}px
*   **Arc (Edge) Line Color:** ${config.arcLineColor}

**Output:**
Return ONLY the raw SVG code as a string. Do not include any explanations, markdown formatting (like \`\`\`svg), or any other text outside of the SVG content itself. The SVG must be well-formed and ready to be rendered directly in an HTML 'div'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let svgContent = response.text.trim();
    if (svgContent.startsWith('```svg')) {
      svgContent = svgContent.substring(5);
    }
    if (svgContent.endsWith('```')) {
      svgContent = svgContent.substring(0, svgContent.length - 3);
    }
    return svgContent.trim();

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate pathway visualization. Please check your API key and try again.");
  }
}
