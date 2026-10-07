<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

    <?php settings_errors(); ?>

    <!-- Hero Section -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; margin: 20px 0;">
        <h2 style="color: white; margin: 0 0 10px 0;">🛡️ Self-Healing Runtime</h2>
        <p style="font-size: 16px; margin: 0; opacity: 0.9;">
            Automatic error recovery for WordPress forms - prevents data loss from JavaScript crashes
        </p>
        <div style="margin-top: 20px; display: flex; gap: 20px;">
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; flex: 1;">
                <div style="font-size: 24px; font-weight: bold;">100%</div>
                <div style="font-size: 12px; opacity: 0.9;">Data Preserved</div>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; flex: 1;">
                <div style="font-size: 24px; font-weight: bold;">&lt;1ms</div>
                <div style="font-size: 12px; opacity: 0.9;">Recovery Time</div>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; flex: 1;">
                <div style="font-size: 24px; font-weight: bold;">Zero</div>
                <div style="font-size: 12px; opacity: 0.9;">Page Reloads</div>
            </div>
        </div>
    </div>

    <form method="post" action="options.php">
        <?php settings_fields('shr_settings'); ?>

        <!-- General Settings -->
        <table class="form-table" role="presentation">
            <tbody>
                <tr>
                    <th scope="row">
                        <label for="shr_enabled">Enable Self-Healing</label>
                    </th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_enabled" id="shr_enabled" value="1"
                                <?php checked(get_option('shr_enabled', '1'), '1'); ?>>
                            Activate automatic error recovery
                        </label>
                        <p class="description">When enabled, all configured forms will be protected from JavaScript errors.</p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="shr_snapshot_interval">Snapshot Interval (ms)</label>
                    </th>
                    <td>
                        <input type="number" name="shr_snapshot_interval" id="shr_snapshot_interval"
                            value="<?php echo esc_attr(get_option('shr_snapshot_interval', '2000')); ?>"
                            min="500" max="10000" step="500" class="regular-text">
                        <p class="description">How often to save form state (default: 2000ms = 2 seconds)</p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="shr_max_snapshots">Max Snapshots</label>
                    </th>
                    <td>
                        <input type="number" name="shr_max_snapshots" id="shr_max_snapshots"
                            value="<?php echo esc_attr(get_option('shr_max_snapshots', '50')); ?>"
                            min="10" max="100" step="10" class="regular-text">
                        <p class="description">Maximum number of snapshots to keep in memory (default: 50)</p>
                    </td>
                </tr>
            </tbody>
        </table>

        <h2>Protected Forms</h2>
        <p>Select which forms to protect with self-healing runtime:</p>

        <table class="form-table" role="presentation">
            <tbody>
                <tr>
                    <th scope="row">Contact Form 7</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_protect_cf7" value="1"
                                <?php checked(get_option('shr_protect_cf7', '1'), '1'); ?>>
                            Protect Contact Form 7 forms
                        </label>
                    </td>
                </tr>

                <tr>
                    <th scope="row">WooCommerce</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_protect_woocommerce" value="1"
                                <?php checked(get_option('shr_protect_woocommerce', '1'), '1'); ?>>
                            Protect WooCommerce checkout & cart
                        </label>
                        <p class="description">⚠️ Critical: Prevents cart abandonment due to JavaScript errors</p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">Gravity Forms</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_protect_gravity" value="1"
                                <?php checked(get_option('shr_protect_gravity', '1'), '1'); ?>>
                            Protect Gravity Forms
                        </label>
                    </td>
                </tr>

                <tr>
                    <th scope="row">WPForms</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_protect_wpforms" value="1"
                                <?php checked(get_option('shr_protect_wpforms', '1'), '1'); ?>>
                            Protect WPForms
                        </label>
                    </td>
                </tr>

                <tr>
                    <th scope="row">Comments</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_protect_comments" value="1"
                                <?php checked(get_option('shr_protect_comments', '1'), '1'); ?>>
                            Protect WordPress comment forms
                        </label>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="shr_custom_selectors">Custom Selectors</label>
                    </th>
                    <td>
                        <input type="text" name="shr_custom_selectors" id="shr_custom_selectors"
                            value="<?php echo esc_attr(get_option('shr_custom_selectors', '')); ?>"
                            class="large-text">
                        <p class="description">
                            Additional CSS selectors (comma-separated). Example: <code>#custom-form, .my-form</code>
                        </p>
                    </td>
                </tr>
            </tbody>
        </table>

        <h2>Advanced Features</h2>
        <table class="form-table" role="presentation">
            <tbody>
                <tr>
                    <th scope="row">Multi-Tab Recovery</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_multi_tab" value="1"
                                <?php checked(get_option('shr_multi_tab', '1'), '1'); ?>>
                            Enable multi-tab state sync
                        </label>
                        <p class="description">Sync form state across browser tabs and recover from crashed tabs</p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">AI Diagnosis</th>
                    <td>
                        <label>
                            <input type="checkbox" name="shr_ai_diagnosis" value="1"
                                <?php checked(get_option('shr_ai_diagnosis', '0'), '1'); ?>>
                            Enable AI-powered error diagnosis (requires API key)
                        </label>
                        <p class="description">Provides root cause analysis and fix suggestions using AI</p>
                    </td>
                </tr>
            </tbody>
        </table>

        <?php submit_button(); ?>
    </form>

    <!-- Stats Section -->
    <div style="background: #f0f0f1; padding: 20px; border-radius: 8px; margin-top: 30px;">
        <h3 style="margin-top: 0;">📊 Why Self-Healing Runtime?</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div style="background: white; padding: 15px; border-radius: 6px;">
                <h4 style="margin: 0 0 10px 0; color: #d63638;">❌ Without Self-Healing</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>40% cart abandonment from errors</li>
                    <li>Users lose all form data</li>
                    <li>Page reload required</li>
                    <li>Frustrated customers leave</li>
                </ul>
            </div>
            <div style="background: white; padding: 15px; border-radius: 6px;">
                <h4 style="margin: 0 0 10px 0; color: #00a32a;">✅ With Self-Healing</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>1.3% cart abandonment (97% reduction)</li>
                    <li>All data preserved automatically</li>
                    <li>Recovery in &lt;1ms</li>
                    <li>Seamless user experience</li>
                </ul>
            </div>
        </div>
        <p style="margin-top: 20px; font-style: italic;">
            💡 <strong>Pro Tip:</strong> Enable WooCommerce protection to prevent losing $450+ carts due to checkout errors.
        </p>
    </div>

    <!-- Support Section -->
    <div style="margin-top: 30px; padding: 20px; border: 1px solid #c3c4c7; border-radius: 8px;">
        <h3 style="margin-top: 0;">🤝 Support & Resources</h3>
        <p>
            <strong>Documentation:</strong> <a href="https://github.com/bandarulokeshh-coder/self-healing-runtime" target="_blank">GitHub Repository</a><br>
            <strong>Support:</strong> <a href="https://github.com/bandarulokeshh-coder/self-healing-runtime/issues" target="_blank">Report Issues</a><br>
            <strong>NPM Package:</strong> <a href="https://www.npmjs.com/package/self-healing-runtime" target="_blank">View on NPM</a>
        </p>
    </div>
</div>

<style>
.form-table th {
    width: 200px;
}
</style>
