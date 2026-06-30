/**
 * A small, self-contained SBGN-ML (Process Description) map bundled with the app
 * so the visualizer works fully offline — no network, no API key. The glyph
 * labels intentionally match the built-in sample gene/compound data so the
 * color overlay is visible on "Load demo".
 */
export const DEMO_SBGN = `<?xml version="1.0" encoding="UTF-8"?>
<sbgn xmlns="http://sbgn.org/libsbgn/0.2">
  <map language="process description">
    <glyph id="comp1" class="compartment">
      <label text="Mitotic cell (demo)"/>
      <bbox x="30" y="55" w="770" h="420"/>
    </glyph>

    <glyph id="g_ccnb1" class="macromolecule"><label text="CCNB1"/><bbox x="90" y="100" w="110" h="44"/></glyph>
    <glyph id="g_cdk1"  class="macromolecule"><label text="CDK1"/><bbox x="90" y="200" w="110" h="44"/></glyph>
    <glyph id="g_plk1"  class="macromolecule"><label text="PLK1"/><bbox x="260" y="100" w="110" h="44"/></glyph>
    <glyph id="g_aurkb" class="macromolecule"><label text="AURKB"/><bbox x="260" y="200" w="110" h="44"/></glyph>
    <glyph id="g_bub1b" class="macromolecule"><label text="BUB1B"/><bbox x="470" y="100" w="110" h="44"/></glyph>
    <glyph id="g_mad2"  class="macromolecule"><label text="MAD2L1"/><bbox x="470" y="200" w="110" h="44"/></glyph>
    <glyph id="g_cdc20" class="macromolecule"><label text="CDC20"/><bbox x="650" y="148" w="110" h="44"/></glyph>
    <glyph id="g_foxm1" class="macromolecule"><label text="FOXM1"/><bbox x="650" y="258" w="110" h="44"/></glyph>

    <glyph id="p1" class="process"><bbox x="360" y="158" w="20" h="20"/></glyph>

    <glyph id="c_pyr" class="simple chemical"><label text="C00022"/><bbox x="110" y="380" w="90" h="40"/></glyph>
    <glyph id="c_pep" class="simple chemical"><label text="C00074"/><bbox x="360" y="380" w="90" h="40"/></glyph>
    <glyph id="c_pro" class="simple chemical"><label text="C00148"/><bbox x="610" y="380" w="90" h="40"/></glyph>
    <glyph id="p2" class="process"><bbox x="266" y="390" w="18" h="18"/></glyph>

    <arc id="a1" class="consumption" source="g_ccnb1" target="p1"><start x="145" y="122"/><end x="366" y="170"/></arc>
    <arc id="a2" class="consumption" source="g_cdk1" target="p1"><start x="145" y="222"/><end x="366" y="176"/></arc>
    <arc id="a3" class="catalysis" source="g_aurkb" target="p1"><start x="315" y="222"/><end x="372" y="180"/></arc>
    <arc id="a4" class="stimulation" source="g_plk1" target="p1"><start x="315" y="122"/><end x="372" y="160"/></arc>
    <arc id="a5" class="inhibition" source="g_bub1b" target="p1"><start x="525" y="122"/><end x="382" y="166"/></arc>
    <arc id="a6" class="inhibition" source="g_mad2" target="p1"><start x="525" y="222"/><end x="382" y="172"/></arc>
    <arc id="a7" class="stimulation" source="g_foxm1" target="p1"><start x="705" y="280"/><end x="382" y="178"/></arc>
    <arc id="a8" class="production" source="p1" target="g_cdc20"><start x="380" y="168"/><end x="650" y="170"/></arc>

    <arc id="b1" class="consumption" source="c_pyr" target="p2"><start x="200" y="400"/><end x="268" y="399"/></arc>
    <arc id="b2" class="production" source="p2" target="c_pep"><start x="284" y="399"/><end x="360" y="400"/></arc>
    <arc id="b3" class="catalysis" source="c_pro" target="p2"><start x="610" y="400"/><end x="284" y="405"/></arc>
  </map>
</sbgn>`;
