<?php
/**
 * Plugin Name: Self-Healing Runtime
 * Plugin URI: https://github.com/bandarulokeshh-coder/self-healing-runtime
 * Description: Production-ready self-healing error boundaries with AI-powered diagnosis and automatic state recovery
 * Version: 1.0.0
 * Author: Lokes
 * Author URI: https://github.com/bandarulokeshh-coder
 * License: MIT
 * Text Domain: self-healing-runtime
 * Requires at least: 5.8
 * Requires PHP: 7.4
 *
 * Features:
 * - Time-Travel Debugging (50-snapshot ring buffer)
 * - Multi-Tab Recovery (BroadcastChannel API)
 * - Live Performance Graphs (LCP, FID, CLS, TTFB)
 * - Auto-detection for Contact Form 7, WooCommerce, Gravity Forms, WPForms
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('SHR_VERSION', '1.0.0');
define('SHR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SHR_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main Self-Healing Runtime Class
 */
class SelfHealingRuntime {

    private static $instance = null;

    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));

        // Add settings link on plugins page
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_settings_link'));
    }

    /**
     * Enqueue frontend scripts
     */
    public function enqueue_scripts() {
        // Only load if enabled
        $enabled = get_option('shr_enabled', '1');
        if ($enabled !== '1') {
            return;
        }

        // Load from jsDelivr CDN (auto-serves npm packages, no separate CDN needed)
        $cdn_url = 'https://cdn.jsdelivr.net/npm/self-healing-runtime@1.0.0/dist-lib/index.umd.js';

        wp_enqueue_script(
            'self-healing-runtime',
            $cdn_url,
            array(), // No dependencies
            SHR_VERSION,
            true // Load in footer
        );

        // Configuration
        $config = array(
            'enabled' => true,
            'snapshotInterval' => intval(get_option('shr_snapshot_interval', '2000')),
            'maxSnapshots' => intval(get_option('shr_max_snapshots', '50')),
            'forms' => $this->get_form_selectors(),
            'aiDiagnosis' => get_option('shr_ai_diagnosis', '0') === '1',
            'multiTab' => get_option('shr_multi_tab', '1') === '1',
        );

        wp_localize_script('self-healing-runtime', 'SHRConfig', $config);

        // Initialize script
        wp_add_inline_script('self-healing-runtime', $this->get_init_script(), 'after');
    }

    /**
     * Get form selectors based on settings
     */
    private function get_form_selectors() {
        $selectors = array();

        // Contact Form 7
        if (get_option('shr_protect_cf7', '1') === '1') {
            $selectors[] = '.wpcf7-form';
        }

        // WooCommerce
        if (get_option('shr_protect_woocommerce', '1') === '1') {
            $selectors[] = '.woocommerce-checkout';
            $selectors[] = '.cart_totals';
            $selectors[] = 'form.checkout';
        }

        // Gravity Forms
        if (get_option('shr_protect_gravity', '1') === '1') {
            $selectors[] = '.gform_wrapper form';
        }

        // WPForms
        if (get_option('shr_protect_wpforms', '1') === '1') {
            $selectors[] = '.wpforms-form';
        }

        // Comments
        if (get_option('shr_protect_comments', '1') === '1') {
            $selectors[] = '#commentform';
        }

        // Custom selectors
        $custom = get_option('shr_custom_selectors', '');
        if (!empty($custom)) {
            $custom_array = array_map('trim', explode(',', $custom));
            $selectors = array_merge($selectors, $custom_array);
        }

        return $selectors;
    }

    /**
     * Get initialization script
     */
    private function get_init_script() {
        return <<<JS
(function() {
    if (typeof SelfHealingRuntime === 'undefined') {
        console.warn('Self-Healing Runtime not loaded');
        return;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSelfHealing);
    } else {
        initSelfHealing();
    }

    function initSelfHealing() {
        console.log('Self-Healing Runtime: Initializing...');

        // Auto-protect all configured forms
        SHRConfig.forms.forEach(function(selector) {
            var forms = document.querySelectorAll(selector);
            forms.forEach(function(form) {
                console.log('Self-Healing Runtime: Protected form', selector);
            });
        });

        console.log('Self-Healing Runtime: Active ✓');
    }
})();
JS;
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Self-Healing Runtime Settings',
            'Self-Healing Runtime',
            'manage_options',
            'self-healing-runtime',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('shr_settings', 'shr_enabled');
        register_setting('shr_settings', 'shr_snapshot_interval');
        register_setting('shr_settings', 'shr_max_snapshots');
        register_setting('shr_settings', 'shr_protect_cf7');
        register_setting('shr_settings', 'shr_protect_woocommerce');
        register_setting('shr_settings', 'shr_protect_gravity');
        register_setting('shr_settings', 'shr_protect_wpforms');
        register_setting('shr_settings', 'shr_protect_comments');
        register_setting('shr_settings', 'shr_custom_selectors');
        register_setting('shr_settings', 'shr_ai_diagnosis');
        register_setting('shr_settings', 'shr_multi_tab');
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        include SHR_PLUGIN_DIR . 'includes/admin-page.php';
    }

    /**
     * Add settings link on plugins page
     */
    public function add_settings_link($links) {
        $settings_link = '<a href="options-general.php?page=self-healing-runtime">Settings</a>';
        array_unshift($links, $settings_link);
        return $links;
    }
}

// Initialize plugin
add_action('plugins_loaded', array('SelfHealingRuntime', 'get_instance'));

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    // Set default options
    add_option('shr_enabled', '1');
    add_option('shr_snapshot_interval', '2000');
    add_option('shr_max_snapshots', '50');
    add_option('shr_protect_cf7', '1');
    add_option('shr_protect_woocommerce', '1');
    add_option('shr_protect_gravity', '1');
    add_option('shr_protect_wpforms', '1');
    add_option('shr_protect_comments', '1');
    add_option('shr_custom_selectors', '');
    add_option('shr_ai_diagnosis', '0');
    add_option('shr_multi_tab', '1');
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    // Clean up if needed
});
