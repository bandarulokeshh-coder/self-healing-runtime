<?php
/**
 * Uninstall script for Self-Healing Runtime
 *
 * Deletes all plugin options when the plugin is uninstalled.
 */

// Exit if accessed directly
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete all options
$options = array(
    'shr_enabled',
    'shr_snapshot_interval',
    'shr_max_snapshots',
    'shr_protect_cf7',
    'shr_protect_woocommerce',
    'shr_protect_gravity',
    'shr_protect_wpforms',
    'shr_protect_comments',
    'shr_custom_selectors',
    'shr_ai_diagnosis',
    'shr_multi_tab',
);

foreach ($options as $option) {
    delete_option($option);
}
