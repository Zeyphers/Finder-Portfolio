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
    url: "https://linkedin.com/in/jacob-szczepaniak",
    iconName: "linkedin"
  },
  {
    id: "link-instagram",
    name: "Instagram Profile",
    url: "https://instagram.com/jacobszczepaniak",
    iconName: "instagram"
  },
  {
    id: "link-facebook",
    name: "Facebook Profile",
    url: "https://facebook.com/jacobszczepaniak",
    iconName: "facebook"
  },
  {
    id: "link-youtube",
    name: "YouTube Channel",
    url: "https://youtube.com/@jacobszczepaniak",
    iconName: "youtube"
  }
];

export const PROJECTS: Project[] = [
  {
    id: "project-1",
    name: "Studio Obscura — Brand Identity",
    category: "Design & Typography",
    badge: "Branding",
    description: "Minimalist visual identity for an experimental design agency and photography workspace.",
    longDescription: "Studio Obscura is an architecture and photography laboratory. The identity program leverages raw geometric layouts, Helvetica-inspired typographic tracking, and high-contrast editorial spacing. Standard black-and-white print materials are textured with organic paper selections and minimal foil overlays to express architectural authenticity.",
    client: "Obscura Labs",
    year: "2026",
    behanceUrl: "https://behance.net/portfolio-designer",
    tags: ["Branding", "Typography", "Print Layout", "Stationery Logo", "Brand System"],
    imageUrl: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80",
    features: [
      "Monochrome vector letterhead configurations",
      "Dynamic business card alignments with heavy micro-margins",
      "Skins for portfolio catalogs using extreme grid structures",
      "Custom responsive assets for social, stationery, and mobile envelopes"
    ],
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=85",
        caption: "Studio Obscura Stationery: Letterhead, custom folders and business card layout."
      },
      {
        url: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1200&q=85",
        caption: "Corporate brand guidelines: typographic rhythm, grid structure, and grid layouts."
      },
      {
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85",
        caption: "Abstract generative artwork representing the digital lens aspect of Obscura."
      },
      {
        url: "https://images.unsplash.com/photo-1509343256512-d77a5cb3791b?auto=format&fit=crop&w=1200&q=85",
        caption: "Art prints, custom editorial formatting, and geometric alignment layouts."
      }
    ],
    wordpressCode: {
      customPostType: `// Add this to your child theme's functions.php to register 'Branding Project' Custom Post Type
add_action('init', 'register_portfolio_cpt');
function register_portfolio_cpt() {
    $labels = array(
        'name'               => _x('Design Projects', 'post type general name'),
        'singular_name'      => _x('Design Project', 'post type singular name'),
        'menu_name'          => _x('Design Projects', 'admin menu'),
        'add_new_item'       => __('Add New Project'),
        'edit_item'          => __('Edit Project'),
        'all_items'          => __('All Projects'),
    );
    $args = array(
        'labels'             => $labels,
        'public'             => true,
        'has_archive'        => true,
        'supports'           => array('title', 'editor', 'thumbnail', 'excerpt'),
        'menu_icon'          => 'dashicons-portfolio',
        'show_in_rest'       => true, // Enables Gutenberg Editor
        'rewrite'            => array('slug' => 'portfolio'),
    );
    register_post_type('portfolio', $args);
}`,
      acfFields: `// Advanced Custom Fields (ACF) Setup:
// Create an ACF Field Group for 'portfolio' post type with the following fields:
// 1. client_name (Text field) -> holds e.g. "Obscura Labs"
// 2. project_year (Text field) -> holds e.g. "2026"
// 3. behance_url (Url field) -> holds e.g. "https://behance.net/portfolio-designer"
// 4. gallery_images (Repeater Field) -> child "image" field returning URL`,
      phpQuery: `<?php
// PHP query and loop file to display this gallery loop on standard archive pages:
$query = new WP_Query(array(
    'post_type'      => 'portfolio',
    'posts_per_page' => 10,
    'post_status'    => 'publish'
));

if ($query->have_posts()) :
    echo '<div class="gallery-grid">';
    while ($query->have_posts()) : $query->the_post();
        $gallery = get_field('gallery_images');
        $year    = get_field('project_year') ?: '2026';
        $client  = get_field('client_name') ?: 'Client';
        ?>
        <article class="gallery-item">
            <h3 class="title"><?php the_title(); ?></h3>
            <span class="year"><?php echo esc_html($year); ?></span>
            <div class="thumbnails">
                <?php if ($gallery): foreach($gallery as $img): ?>
                    <img src="<?php echo esc_url($img['image']['url']); ?>" alt="<?php echo esc_attr($img['caption']); ?>" />
                <?php endforeach; endif; ?>
            </div>
        </article>
        <?php
    endwhile;
    wp_reset_postdata();
    echo '</div>';
endif;
?>`,
      instructions: "1. Copy the custom post type registration code into your Active WordPress Theme's 'functions.php'.\n2. Set up Advanced Custom Fields with a 'gallery_images' Repeater type as configured above.\n3. Integrate the custom image gallery templates using standard loop logic or use WordPress headless REST with react-gallery hooks."
    }
  },
  {
    id: "project-2",
    name: "Kinetic Swiss Poster Series",
    category: "Print & Typography",
    badge: "Editorial",
    description: "A series of high-contrast posters utilizing grid layouts, Swiss graphic design rules, and bold fonts.",
    longDescription: "This series exploring kinetic typography uses the classic Swiss school alignment rules with a grit industrial element. Developed for print and outdoor displays in major design spaces, each layout is constructed using absolute typography rules, micro letterhead tags, and standard primary geometric structures.",
    client: "Zurich Design Council",
    year: "2025",
    behanceUrl: "https://behance.net/portfolio-designer",
    tags: ["Swiss Design", "Helvetica", "Poster Print", "Geometric Layout", "Grid Rhythm"],
    imageUrl: "https://images.unsplash.com/photo-1561070791-26c113006238?auto=format&fit=crop&w=800&q=80",
    features: [
      "Rigid Swiss typography grid layouts",
      "High-contrast black, crimson, and alabaster palettes",
      "Simulated paper textures built into vector asset sheets",
      "Dynamic overlapping layout patterns with precise horizontal alignment lines"
    ],
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=85",
        caption: "Monochrome vector typesetting: exploring contrast, dynamic sizing, and whitespace rules."
      },
      {
        url: "https://images.unsplash.com/photo-1509343256512-d77a5cb3791b?auto=format&fit=crop&w=1200&q=85",
        caption: "Swiss design poster layout framed inside a minimal matte black mockup."
      },
      {
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85",
        caption: "Generative geometric wave layout designed as a supplementary background asset."
      }
    ],
    wordpressCode: {
      customPostType: `// functions.php - Custom Post Type for Poster Layouts
add_action('init', 'register_swiss_posters_cpt');
function register_swiss_posters_cpt() {
    register_post_type('swiss_poster', array(
        'label'        => 'Swiss Posters',
        'public'       => true,
        'show_in_rest' => true, 
        'supports'     => array('title', 'editor', 'thumbnail'),
        'menu_icon'    => 'dashicons-format-image'
    ));
}`,
      acfFields: `// ACF Setup for Swiss Posters:
// 1. designer_notes (Wysiwyg editor) -> holds design essays
// 2. print_dimensions (Text, e.g. "70 x 100 cm")
// 3. ink_specification (Text, e.g. "Pantone Black, 032C Red")`,
      phpQuery: `<?php
// Simple single-swiss_poster.php block in Theme to capture Swiss Poster meta variables:
$dimensions = get_field('print_dimensions');
$ink        = get_field('ink_specification');
$notes      = get_field('designer_notes');
?>
<div class="poster-meta-rail text-xs font-mono py-4 border-t border-slate-700">
    <div><strong>SIZE:</strong> <?php echo esc_html($dimensions); ?></div>
    <div><strong>COLORS:</strong> <?php echo esc_html($ink); ?></div>
    <div class="notes pt-2"><?php echo wp_kses_post($notes); ?></div>
</div>`,
      instructions: "1. Paste the'swiss_poster' post type code to functions.php.\n2. Install ACF and map the 'print_dimensions' and 'ink_specification' fields to the post type.\n3. Include the php single block inside your theme custom template file to render high fidelity design data sheets."
    }
  },
  {
    id: "project-3",
    name: "Aura Cosmetics & Skincare",
    category: "Digital & Packaging",
    badge: "Packaging",
    description: "Sustainable glass containers, organic tactile boxes, and fluid digital branding for skincare formulations.",
    longDescription: "Aura Skin is a bespoke skincare brand for sustainable cosmetics. The design scope includes selecting zero-waste biodegradable packaging materials, premium textured brown outer cardboard boxes with embossed typography, and custom glass bottle form factors. Supplementary digital mockups and UI screens present the product lineup in high visual fidelity.",
    client: "Aura Botanicals LLC",
    year: "2025",
    behanceUrl: "https://behance.net/portfolio-designer",
    tags: ["Packaging Layout", "Eco Materials", "Sustainable Form", "Product Rendering", "Digital Web Art"],
    imageUrl: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80",
    features: [
      "Tactile cardboard box package templates with high-efficiency folding lines",
      "Bespoke glass bottle embossments and minimal paper label specifications",
      "Product-line webpage designs with high typographic contrast",
      "Sustainable design asset parameters with eco-friendly ink ratios"
    ],
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=85",
        caption: "Aura skincare system: high contrast studio shot of organic glass serums and oils."
      },
      {
        url: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=1200&q=85",
        caption: "Minimalist ceramic packaging mockup displaying pure ingredients and elegant label design."
      },
      {
        url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=1200&q=85",
        caption: "Tactile materials, glass reflection modeling, and organic stone-ground backdrops."
      }
    ],
    wordpressCode: {
      customPostType: `// functions.php - Register Cosmetics Product CPT
add_action('init', 'register_aura_products_cpt');
function register_aura_products_cpt() {
    register_post_type('packaging_product', array(
        'label'        => 'Packaging Products',
        'public'       => true,
        'has_archive'  => true,
        'supports'     => array('title', 'editor', 'thumbnail'),
        'menu_icon'    => 'dashicons-tag'
    ));
}`,
      acfFields: `// ACF configuration for Product details:
// 1. material_type (Select: Glass, Cardboard, Cornstarch, Tin)
// 2. recyclable_percentage (Number fields)
// 3. dynamic_tagline (Text)`,
      phpQuery: `<?php
// Query list template inside WordPress page-packaging.php:
$products = new WP_Query(array('post_type' => 'packaging_product', 'posts_per_page' => 12));
while($products->have_posts()): $products->the_post();
    $material = get_field('material_type');
    $recycle  = get_field('recyclable_percentage');
    ?>
    <div class="packaging-card bg-neutral-900 overflow-hidden rounded shadow border border-neutral-800">
        <?php the_post_thumbnail('medium', array('class' => 'w-full h-48 object-cover')); ?>
        <div class="p-4">
            <h4 class="text-white text-md font-sans"><?php the_title(); ?></h4>
            <div class="text-neutral-400 text-xs font-mono mt-1">Material: <?php echo esc_html($material); ?> &bull; <?php echo esc_html($recycle); ?>% Recyclable</div>
        </div>
    </div>
<?php endwhile; wp_reset_postdata(); ?>`,
      instructions: "1. Paste CPT to child functions.php.\n2. Configure material dropdowns and percentages inside ACF fields dashboard.\n3. Call custom fields from your theme collection sheets to construct clean environmental specs next to design assets."
    }
  },
  {
    id: "project-4",
    name: "Velo Track Cycling Application",
    category: "Digital & Product",
    badge: "UI/UX App",
    description: "Retro-modern mobile application layouts and visual guidelines for track racing telemetry.",
    longDescription: "Velo Velodrome merges 90s athletic color codes with super-crisp Vector UI. The scope covers extensive wireframes, interactive typography scales utilizing italic grotesque headers, track vector shapes, and mobile mockups showcasing analytics streams for track-cyclists.",
    client: "Velo Club London",
    year: "2025",
    behanceUrl: "https://behance.net/portfolio-designer",
    tags: ["Mobile Layout", "UI/UX System", "Grotesque Font", "Sports Vector", "App Asset"],
    imageUrl: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=800&q=80",
    features: [
      "Bespoke racing metric dials and circular velocity arcs",
      "Typography guidelines pairing high-impact sans and technical monos",
      "Retro sportswear layouts with neon green and charcoal color pallets",
      "Full interactive screen layout sheets with multi-layer overlays"
    ],
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=85",
        caption: "Track environment photography providing inspiration for speed lines and athletic typography."
      },
      {
        url: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1200&q=85",
        caption: "High fidelity interface mockup: analyzing performance telemetry during active laps."
      },
      {
        url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=85",
        caption: "Digital engineering curves, telemetry grids, and sports-science database diagrams."
      }
    ],
    wordpressCode: {
      customPostType: `// functions.php - Register App Layouts CPT
add_action('init', 'register_app_designs_cpt');
function register_app_designs_cpt() {
    register_post_type('app_design', array(
        'label'        => 'App Layouts',
        'public'       => true,
        'show_in_rest' => true,
        'supports'     => array('title', 'editor', 'thumbnail', 'excerpt'),
        'menu_icon'    => 'dashicons-smartphone'
    ));
}`,
      acfFields: `// ACF Variables for App Designs:
// 1. layout_screen_count (Number) -> screen layouts count
// 2. key_color (Color Picker) -> theme primary (e.g. #39ff14)
// 3. typography_stack_used (Text field) -> Font family titles`,
      phpQuery: `<?php
// WP-json API controller to extract screen layouts and color codes for modern headless setups:
// Fetch standard screens: wp-json/wp/v2/app_design
// Add custom responsive field rendering in theme REST outputs:
add_action('rest_api_init', 'register_acf_fields_in_rest');
function register_acf_fields_in_rest() {
    register_rest_field('app_design', 'custom_metadata', array(
        'get_callback' => function($post_arr) {
            $post_id = $post_arr['id'];
            return array(
                'screen_count' => get_field('layout_screen_count', $post_id),
                'key_color'    => get_field('key_color', $post_id),
                'font_stack'   => get_field('typography_stack_used', $post_id)
            );
        }
    ));
}
?>`,
      instructions: "1. Append CPT to functions.php.\n2. Configure color pickers and numbers in ACF Admin and tag to 'app_design' posts.\n3. Make frictionless REST fetch queries to extract design parameters directly into client components."
    }
  },
  {
    id: "project-5",
    name: "AeroLuxe Furniture E-Commerce",
    category: "WordPress Custom Theme",
    badge: "WooCommerce",
    description: "A premium, block-editor optimized WooCommerce theme crafted for high-end designer furniture brands.",
    longDescription: "AeroLuxe is a fully custom WordPress and WooCommerce theme developed with the hybrid block engine. It boasts 100% Core Web Vitals scores, responsive fluid-responsive typography, and a tailored cart and checkout flow designed to reduce friction and increase average order values.",
    client: "AeroLuxe Interior",
    year: "2025",
    behanceUrl: "https://behance.net/portfolio-designer",
    tags: ["WordPress", "PHP", "WooCommerce", "Tailwind CSS", "Gutenberg"],
    imageUrl: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
    features: [
      "Custom WooCommerce Cart & Checkout layouts",
      "Full Site Editing (FSE) block template patterns",
      "Dynamic AJAX search and faceted product filter drawer",
      "SEO optimized with custom JSON-LD schema breadcrumbs"
    ],
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=85",
        caption: "Bespoke minimalist sofa layout rendering: exploring warm shadows, luxury oak wood and alignment."
      },
      {
        url: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1200&q=85",
        caption: "Designer chair and statement lighting alignment: translating premium physical design to product columns."
      },
      {
        url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=85",
        caption: "Skins, grid bento rows, and architectural block columns for eCommerce catalog."
      }
    ],
    wordpressCode: {
      customPostType: `// Add this to your child theme's functions.php to register 'Project' Custom Post Type
add_action('init', 'register_portfolio_cpt');
function register_portfolio_cpt() {
    $labels = array(
        'name'               => _x('Projects', 'post type general name'),
        'singular_name'      => _x('Project', 'post type singular name'),
        'menu_name'          => _x('Projects', 'admin menu'),
        'add_new_item'       => __('Add New Project'),
        'edit_item'          => __('Edit Project'),
        'all_items'          => __('All Projects'),
        'view_item'          => __('View Project'),
    );
    $args = array(
        'labels'             => $labels,
        'public'             => true,
        'has_archive'        => true,
        'supports'           => array('title', 'editor', 'thumbnail', 'excerpt'),
        'menu_icon'          => 'dashicons-portfolio',
        'show_in_rest'       => true, // Enables Gutenberg Editor
        'rewrite'            => array('slug' => 'portfolio'),
    );
    register_post_type('portfolio', $args);
}`,
      acfFields: `// Suggested Advanced Custom Fields (ACF) setup or Gutenberg blocks:
// Define the following text fields for post type 'portfolio':
// 1. client_name (Text field, e.g., "AeroLuxe Interior")
// 2. project_year (Number/Text, e.g., "2025")
// 3. live_demo_url (URL field, e.g., "https://aeroluxe.example.com")
// 4. badge_label (Text, e.g. "WooCommerce")
// 5. custom_tags (Taxonomy or Text, e.g. "WordPress, WooCommerce, PHP")`,
      phpQuery: `<?php
// PHP query loop to fetch projects inside your WordPress template file (e.g. archive-portfolio.php or single-portfolio.php)
$args = array(
    'post_type'      => 'portfolio',
    'posts_per_page' => 12,
    'post_status'    => 'publish'
);

$query = new WP_Query($args);

if ($query->have_posts()) :
    echo '<div class="finder-grid gap-4">';
    while ($query->have_posts()) : $query->the_post();
        // Get custom ACF meta values 
        $client = get_field('client_name');
        $badge = get_field('badge_label') ?: 'Standard';
        $year   = get_field('project_year') ?: '2025';
        $url    = get_field('live_demo_url');
        ?>
        <div class="folder-card p-4 bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition" id="post-<?php the_ID(); ?>">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sky-500 font-mono text-xs px-2 py-0.5 rounded bg-sky-500/10"><?php echo esc_html($badge); ?></span>
                <span class="text-xs text-slate-400"><?php echo esc_html($year); ?></span>
            </div>
            <h3 class="text-white font-semibold text-sm mb-1"><?php the_title(); ?></h3>
            <p class="text-xs text-slate-300"><?php echo wp_trim_words(get_the_excerpt(), 15); ?></p>
        </div>
        <?php
    endwhile;
    echo '</div>';
    wp_reset_postdata();
else :
    echo '<p>No projects found.</p>';
endif;
?>`,
      instructions: "1. Copy the CPT registration into your theme's functions.php.\n2. Install ACF (Advanced Custom Fields) and create critical fields (client_name, live_demo_url, etc.) targeted to the 'portfolio' post type.\n3. Create 'archive-portfolio.php' template in your theme folder with the query code to render the projects in your Finder layouts!"
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
