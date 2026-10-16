// Génère des propositions de fond avec FLUX.1 schnell via l'API HTTP de ComfyUI (http://127.0.0.1:8188).
// Usage : deno run -A tools/flux_gen.ts <fichier-prompts.json> <dossier-sortie>
// Le fichier de prompts est une liste de { "nom": "...", "prompt": "...", "seeds": [1, 2] }.
const API = Deno.env.get("COMFY") ?? "http://127.0.0.1:8188";
const [promptFile, outDir] = Deno.args;
if (!promptFile || !outDir) throw new Error("usage : flux_gen.ts <prompts.json> <dossier>");
const jobs: { nom: string; prompt: string; seeds: number[] }[] = JSON.parse(await Deno.readTextFile(promptFile));
await Deno.mkdir(outDir, { recursive: true });

// 1920 x 1088 : multiple de 16, recadré en 1920 x 1080 par le CSS (background-size: cover).
function workflow(text: string, seed: number, prefix: string) {
  return {
    unet: { class_type: "UNETLoader", inputs: { unet_name: "flux1-schnell.safetensors", weight_dtype: "fp8_e4m3fn" } },
    clip: { class_type: "DualCLIPLoader", inputs: { clip_name1: "t5xxl_fp16.safetensors", clip_name2: "clip_l.safetensors", type: "flux" } },
    vae: { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    pos: { class_type: "CLIPTextEncode", inputs: { text, clip: ["clip", 0] } },
    neg: { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["clip", 0] } },
    lat: { class_type: "EmptySD3LatentImage", inputs: { width: 1920, height: 1088, batch_size: 1 } },
    ks: {
      class_type: "KSampler",
      inputs: { model: ["unet", 0], positive: ["pos", 0], negative: ["neg", 0], latent_image: ["lat", 0],
        seed, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 },
    },
    dec: { class_type: "VAEDecode", inputs: { samples: ["ks", 0], vae: ["vae", 0] } },
    save: { class_type: "SaveImage", inputs: { images: ["dec", 0], filename_prefix: prefix } },
  };
}

for (const job of jobs) {
  for (const seed of job.seeds) {
    const t0 = Date.now();
    const r = await fetch(`${API}/prompt`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: workflow(job.prompt, seed, `site-jeux/${job.nom}`) }) });
    if (!r.ok) throw new Error(`${job.nom} : ${r.status} ${await r.text()}`);
    const { prompt_id } = await r.json();
    let out;
    for (;;) {
      await new Promise((res) => setTimeout(res, 1500));
      const h = await (await fetch(`${API}/history/${prompt_id}`)).json();
      const e = h[prompt_id];
      if (!e) continue;
      if (e.status?.status_str === "error") throw new Error(`${job.nom} : ${JSON.stringify(e.status.messages)}`);
      out = e.outputs?.save?.images?.[0];
      if (out) break;
    }
    const img = await fetch(`${API}/view?${new URLSearchParams({ filename: out.filename, subfolder: out.subfolder, type: out.type })}`);
    const file = `${outDir}/${job.nom}-${seed}.png`;
    await Deno.writeFile(file, new Uint8Array(await img.arrayBuffer()));
    console.log(file, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}
