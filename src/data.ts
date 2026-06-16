import { Project } from "./types";

export interface ExternalLink {
  id: string;
  name: string;
  url: string;
  iconName: string;
}

export const EXTERNAL_LINKS: ExternalLink[] = [
  {
    id: "link-linkedin",
    name: "LinkedIn Profile",
    url: "https://www.linkedin.com/in/jacob-szczepaniak-109031276/",
    iconName: "linkedin"
  },
  {
    id: "link-instagram",
    name: "Instagram Profile",
    url: "https://www.instagram.com/jake_jz_/",
    iconName: "instagram"
  },
  {
    id: "link-facebook",
    name: "Facebook Profile",
    url: "https://www.facebook.com/jacob.szczepaniak/",
    iconName: "facebook"
  },
  {
    id: "link-youtube",
    name: "YouTube Channel",
    url: "https://www.youtube.com/@zeypher_863",
    iconName: "youtube"
  }
];

export const PROJECTS: Project[] = [
  {
    id: "project-1",
    name: "Blender 3D — Digital Art & VFX",
    category: "3D Modeling & Rendering",
    badge: "Blender 3D",
    description: "Immersive 3D environments, custom model rendering, and lighting designs in Blender.",
    longDescription: "A collection of 3D modeling, lighting, and cinematic composition work in Blender. This series explores volumetric simulations, metallic texture shaders, and modern architecture. Integrating Adobe CC tools with custom workflows, each render showcases a unique exploration into 3D storytelling, combining complex shapes and fine details to build convincing virtual realms.",
    client: "Personal Works",
    year: "2024",
    behanceUrl: "https://jacobszczepaniak.com/",
    tags: ["Blender 3D", "Lighting Work", "Cycles Render", "Product Rendering", "Volumetrics"],
    imageUrl: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/blackhole-1-1024x576.png",
    features: [
      "Custom procedural texture systems and Cycles optimization",
      "Dynamic volumetric light rays and physical lens distortions",
      "Sophisticated asset composition and structural geometries",
      "Blender node operations for advanced material shading"
    ],
    gallery: [
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/blackhole-1-1024x576.png",
        caption: "Bending Light: Gravitational lensing rendering created inside Blender Cycles."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/currents-1-1024x1024.png",
        caption: "Currents: Wave heightmap fields and material gradient transitions."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/Cube_Man-1-1024x576.png",
        caption: "Cube Man: Hard-surface structural model under ambient cold light."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/sadness-2-1024x683.png",
        caption: "Sadness: Low-key dramatic keylighting scene, focus on emotional posing."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/rendered_weapon-2-1024x576.png",
        caption: "High fidelity firearm model showcasing metallic textures, rust, and wear."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/12/couch-1024x576.jpg",
        caption: "Architectural Asset: photorealistic leather sofa model inside clean studio environment."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/12/Primrose-Triangle-1021x1024.png",
        caption: "Primrose Triangle: Geometric model experimenting with refractive crystal properties."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2024/11/render-1024x540.png",
        caption: "Landscape study with detailed foliage, atmospheric fog, and soft backlighting."
      }
    ],
    wordpressCode: {
      customPostType: `// Add this to functions.php to register 'Blender Work' Custom Post Type
add_action('init', 'register_blender_cpt');
function register_blender_cpt() {
    register_post_type('blender_work', array(
        'labels' => array(
            'name' => __('Blender Works'),
            'singular_name' => __('Blender Work')
        ),
        'public' => true,
        'has_archive' => true,
        'supports' => array('title', 'editor', 'thumbnail'),
        'menu_icon' => 'dashicons-art',
        'show_in_rest' => true
    ));
}`,
      acfFields: `// ACF Field Group for 'blender_work':
// 1. render_engine (Select field: Cycles, Eevee, Octane)
// 2. creation_year (Text field, e.g., '2024')
// 3. software_used (Text area: Blender, Substance Painter)
// 4. project_images (Gallery/Repeater field for multiple images)`,
      phpQuery: `<?php
$query = new WP_Query(array('post_type' => 'blender_work', 'posts_per_page' => 12));
if ($query->have_posts()) :
    while ($query->have_posts()) : $query->the_post();
        $engine = get_field('render_engine') ?: 'Cycles';
        ?>
        <div class="render-item">
            <h2><?php the_title(); ?></h2>
            <div class="engine">Engine: <?php echo esc_html($engine); ?></div>
            <?php the_post_thumbnail('large'); ?>
        </div>
    <?php endwhile; wp_reset_postdata(); endif; ?>`,
      instructions: "1. Paste CPT to functions.php.\n2. Configure ACF with fields render_engine, software_used, etc.\n3. Implement the custom grid loop on your portfolio pages to render your 3D models."
    }
  },
  {
    id: "project-2",
    name: "Generative Work — Fractals & Abstract VFX",
    category: "Math GFX & Iteration",
    badge: "Fractals",
    description: "Bespoke digital design, complex recursive shapes, and text-graphic layouts.",
    longDescription: "An exploration into mathematical beauty and procedural generative art. Combining specialized rendering formulas with standard modern Adobe systems, this work captures recursive geometric patterns, vector loops, and high-contrast styling. These fractals represent a continuous search for complexity and balance within computer-generated imagery.",
    client: "Design Exploration",
    year: "2024",
    behanceUrl: "https://jacobszczepaniak.com/",
    tags: ["Generative Art", "Flowframes", "Fractals", "Unity GFX", "Abstract Layout"],
    imageUrl: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/Fractal-1-1-1024x576.png",
    features: [
      "Procedural mathematical math formulas and mesh generation",
      "Vector layouts with perfect geometric scaling structures",
      "High-contrast color selections with experimental layouts",
      "Animation loops utilizing motion interpolation models"
    ],
    gallery: [
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/Fractal-1-1-1024x576.png",
        caption: "Fractal Genesis: Infinite recursive geometry study rendered in rich violet tones."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/Fractal-1-2-1024x576.png",
        caption: "Fractal Horizon: Atmospheric depth rendering of high-frequency geometric nodes."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/fractal4-2-1024x576.png",
        caption: "Fractal 4: Fluid, flowing recursive structures with organic noise overlays."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/fractal-2-2-1024x576.png",
        caption: "Fractal Core: Centralization of detail and micro-particle noise systems."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/The_slow_rush_TEXT-1024x1024.png",
        caption: "The Slow Rush: Typography and minimalist text layout experimenting with poster contrast."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2025/01/Short-2-1024x576.gif",
        caption: "Short 2: Animated vector loops highlighting retro-modern technological waves."
      }
    ],
    wordpressCode: {
      customPostType: `// Add this to functions.php to register 'Generative GFX' Custom Post Type
add_action('init', 'register_generative_cpt');
function register_generative_cpt() {
    register_post_type('generative_gfx', array(
        'labels' => array(
            'name' => __('Generative Work'),
            'singular_name' => __('Generative Work')
        ),
        'public' => true,
        'has_archive' => true,
        'supports' => array('title', 'editor', 'thumbnail'),
        'menu_icon' => 'dashicons-category',
        'show_in_rest' => true
    ));
}`,
      acfFields: `// ACF Field Group for 'generative_gfx':
// 1. rendering_math (Text area: e.g. Mandelbrot, Julia Set, Perlin)
// 2. motion_animated (True/False toggle)
// 3. resolution_details (Text: e.g. 4K, 8K, Vector)`,
      phpQuery: `<?php
$query = new WP_Query(array('post_type' => 'generative_gfx', 'posts_per_page' => 10));
if ($query->have_posts()) :
    while ($query->have_posts()) : $query->the_post();
        $math = get_field('rendering_math');
        ?>
        <div class="generative-item">
            <h3><?php the_title(); ?></h3>
            <p>Mathematics: <?php echo esc_html($math); ?></p>
            <?php the_post_thumbnail('medium_large'); ?>
        </div>
    <?php endwhile; wp_reset_postdata(); endif; ?>`,
      instructions: "1. Copy CPT registration to functions.php.\n2. Add the custom field structure in ACF mapped to 'generative_gfx'.\n3. Query the posts on your homepage/archive files to showcase your abstract art."
    }
  },
  {
    id: "project-3",
    name: "Photography Collection — Film & Digital",
    category: "Realism & Street Shooting",
    badge: "Photography",
    description: "Capturing fleeting moments, architectural compositions, and nostalgic street captures.",
    longDescription: "A curated gallery of analog and digital street photography. Emphasizing lighting, natural framing, and retro color palettes, this work captures raw emotion and historic textures. Each frame is a study of timing, perspective, and composition, showcasing some of his best analog grain and digital photography setups.",
    client: "Creative Lens",
    year: "2023",
    behanceUrl: "https://jacobszczepaniak.com/",
    tags: ["Street Photography", "Color Grading", "Film Aesthetics", "Composition Study", "Analog Lens"],
    imageUrl: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2316-1024x687.jpg",
    features: [
      "Natural atmosphere captures with organic ambient skylines",
      "Balanced grids and deep focus composition layouts",
      "Custom analog LUT color grading tables",
      "Tactile texture patterns from analog film scanning"
    ],
    gallery: [
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2316-1024x687.jpg",
        caption: "Golden hour study, capturing warm highlights hitting concrete surfaces."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2319-1024x687.jpg",
        caption: "Low-contrast environmental alignment with deep shadow contrast."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2396-1024x687.jpg",
        caption: "Urban Texture: high definition architecture and structure details."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2398-687x1024.jpg",
        caption: "Portrait composition with beautiful, diffused studio natural lighting."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2810-1024x686.jpg",
        caption: "Deep wilderness contrast: dark green tones and soft pine needles."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2815-1024x686.jpg",
        caption: "Nostalgic woodwork: capturing rustic wood grain and antique details."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/DSC_2839-1024x686.jpg",
        caption: "Subtle sky gradients: blue hour transitions above quiet streets."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/000037950004-1024x679.jpg",
        caption: "Nostalgia: Analog film scan with rich, organic grain levels."
      },
      {
        url: "https://jacobszczepaniak.com/wp-content/uploads/2023/11/000037950011-1024x679.jpg",
        caption: "Classic grain: high-definition scanning capturing authentic film characteristics."
      }
    ],
    wordpressCode: {
      customPostType: `// Add this to functions.php to register 'Photography' Custom Post Type
add_action('init', 'register_photography_cpt');
function register_photography_cpt() {
    register_post_type('photography_shot', array(
        'labels' => array(
            'name' => __('Photography Collection'),
            'singular_name' => __('Photo Shot')
        ),
        'public' => true,
        'has_archive' => true,
        'supports' => array('title', 'editor', 'thumbnail'),
        'menu_icon' => 'dashicons-camera',
        'show_in_rest' => true
    ));
}`,
      acfFields: `// ACF Field Group for 'photography_shot':
// 1. lens_used (Text field, e.g. '50mm f/1.8')
// 2. camera_body (Text field, e.g. 'Sony A7R or Nikon FE')
// 3. film_stock (Text: e.g. Kodak Portra 400, Digital RAW)
// 4. location_name (Text)`,
      phpQuery: `<?php
$query = new WP_Query(array('post_type' => 'photography_shot', 'posts_per_page' => 15));
if ($query->have_posts()) :
    while ($query->have_posts()) : $query->the_post();
        $lens = get_field('lens_used');
        $film = get_field('film_stock');
        ?>
        <div class="photo-item shadow-lg rounded">
            <?php the_post_thumbnail('large', array('class' => 'rounded-t')); ?>
            <div class="meta p-3 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-400 font-mono">
                <span>Lens: <?php echo esc_html($lens); ?></span> &bull;
                <span>Stock: <?php echo esc_html($film); ?></span>
            </div>
        </div>
    <?php endwhile; wp_reset_postdata(); endif; ?>`,
      instructions: "1. Paste CPT to functions.php.\n2. Set up Advanced Custom Fields with camera_body, lens_used, and location_name.\n3. Integrate the custom query inside your portfolio sheets to show your gorgeous street photography snapshots."
    }
  }
];

export const SIDEBAR_SECTIONS = [
  {
    title: "Projects",
    items: PROJECTS.map(p => ({
      id: p.id,
      name: p.name.split(" — ")[0], // Just get the title pre-divider for short sidebar name
      iconName: "folder"
    }))
  },
  {
    title: "Links",
    items: EXTERNAL_LINKS.map(l => ({
      id: l.id,
      name: l.name,
      iconName: l.iconName
    }))
  }
];
