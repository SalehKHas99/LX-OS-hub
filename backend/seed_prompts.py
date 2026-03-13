import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

EXAMPLE_USER = {
    "username": "seed_user",
    "email": "seed_user@example.com",
    "password": "seed-password-123",
}

PROMPTS = [
    {
        "title": "Neon alleyway in rainy Tokyo",
        "raw_prompt": "cinematic photograph of a neon-lit alleyway in rainy Tokyo, reflective puddles, soft bokeh lights, moody cyberpunk atmosphere, shot on 50mm lens",
        "model_family": "midjourney",
        "tags": ["cyberpunk", "tokyo", "neon", "street"],
    },
    {
        "title": "Studio portrait of an astronaut",
        "raw_prompt": "studio portrait of an astronaut in a scratched helmet, dramatic rim lighting, shallow depth of field, Hasselblad medium format look",
        "model_family": "stable_diffusion",
        "tags": ["portrait", "astronaut", "studio"],
    },
    {
        "title": "Floating islands at golden hour",
        "raw_prompt": "fantasy landscape of floating islands at golden hour, waterfalls spilling into the clouds, volumetric light rays, painterly concept art",
        "model_family": "flux",
        "tags": ["fantasy", "landscape", "concept-art"],
    },
    {
        "title": "Retro synthwave city skyline",
        "raw_prompt": "80s synthwave city skyline at night, glowing neon grid, palm trees in silhouette, massive sun with scanlines on the horizon, ultra-wide shot",
        "model_family": "midjourney",
        "tags": ["synthwave", "city", "retro", "neon"],
    },
    {
        "title": "Ancient library of floating books",
        "raw_prompt": "ancient library with endless shelves, floating books emitting soft golden light, dust particles in the air, warm volumetric lighting, magical realism",
        "model_family": "stable_diffusion",
        "tags": ["library", "fantasy", "magic"],
    },
    {
        "title": "Cybernetic samurai duel in the rain",
        "raw_prompt": "two cybernetic samurai dueling in the rain on a rooftop, sparks and rain mixing in slow motion, dramatic backlighting, anime-inspired style",
        "model_family": "flux",
        "tags": ["samurai", "cyberpunk", "action"],
    },
    {
        "title": "Glass terrarium planet",
        "raw_prompt": "tiny glass terrarium shaped like a planet, filled with miniature forests and oceans, resting on a wooden desk, soft natural window light, macro shot",
        "model_family": "dalle",
        "tags": ["macro", "terrarium", "planet"],
    },
    {
        "title": "Noir detective in holographic rain",
        "raw_prompt": "noir detective in a trench coat walking through holographic rain, monochrome city with selective neon accents, cinematic lighting, 35mm film grain",
        "model_family": "midjourney",
        "tags": ["noir", "detective", "city"],
    },
    {
        "title": "Underwater cathedral of coral",
        "raw_prompt": "massive underwater cathedral formed entirely of coral and bioluminescent flora, rays of light from above, shoals of fish swimming through the arches",
        "model_family": "stable_diffusion",
        "tags": ["underwater", "architecture", "bioluminescent"],
    },
    {
        "title": "Generative art waveforms",
        "raw_prompt": "abstract generative art of overlapping waveforms, gradient lines and particles forming a data landscape, dark background, vivid cyan and magenta glow",
        "model_family": "other",
        "tags": ["abstract", "generative", "data-viz"],
    },
    {
        "title": "Cozy cabin above the clouds",
        "raw_prompt": "cozy wooden cabin built on a tiny floating island above the clouds, warm light glowing from the windows, night sky full of stars and aurora",
        "model_family": "flux",
        "tags": ["cabin", "sky", "cozy"],
    },
    {
        "title": "Alien rainforest at dawn",
        "raw_prompt": "alien rainforest at dawn with towering bioluminescent plants, misty atmosphere, strange wildlife silhouettes, painterly concept art style",
        "model_family": "comfyui",
        "tags": ["alien", "rainforest", "concept-art"],
    },
]


def main() -> None:
    # 1) Ensure user exists and get token
    try:
        requests.post(f"{BASE_URL}/auth/register", json=EXAMPLE_USER).raise_for_status()
    except requests.HTTPError:
        # Probably already exists; ignore
        pass

    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"login": EXAMPLE_USER["username"], "password": EXAMPLE_USER["password"]},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2) Create prompts
    for p in PROMPTS:
        payload = {
            "title": p["title"],
            "raw_prompt": p["raw_prompt"],
            "model_family": p["model_family"],
            "negative_prompt": None,
            "notes": None,
            "community_id": None,
            "remix_of_id": None,
            "context_blocks": [],
            "tag_slugs": p["tags"],
        }
        r = requests.post(f"{BASE_URL}/prompts", json=payload, headers=headers)
        if r.status_code >= 400:
            print("Failed to seed prompt:", p["title"])
            print("Status:", r.status_code)
            print("Body:", r.text)
            continue
        print("Seeded prompt:", r.json().get("title"))


if __name__ == "__main__":
    main()

