# Add authentication middleware to all protected routes

$routesFile = "server\routes.ts"
$content = Get-Content $routesFile -Raw

# Leads routes (already done, just ensuring)
$content = $content -replace 'app\.post\("/api/leads/bulk-delete",', 'app.post("/api/leads/bulk-delete", isAdmin,'
$content = $content -replace 'app\.post\("/api/leads/bulk-assign-company",', 'app.post("/api/leads/bulk-assign-company", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/leads/:id/send-email",', 'app.post("/api/leads/:id/send-email", isAuthenticated,'

# Email routes
$content = $content -replace 'app\.get\("/api/emails/:leadId",', 'app.get("/api/emails/:leadId", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/emails/sync",', 'app.post("/api/emails/sync", isAuthenticated,'

# Notification routes
$content = $content -replace 'app\.get\("/api/notifications/emails",', 'app.get("/api/notifications/emails", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/notifications/dismiss/:leadId",', 'app.post("/api/notifications/dismiss/:leadId", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/notifications/dismiss-id/:notificationId",', 'app.post("/api/notifications/dismiss-id/:notificationId", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/notifications/clear",', 'app.post("/api/notifications/clear", isAdmin,'

# Companies routes
$content = $content -replace 'app\.get\("/api/companies",', 'app.get("/api/companies", isAuthenticated,'
$content = $content -replace 'app\.get\("/api/companies/:id",', 'app.get("/api/companies/:id", isAuthenticated,'
$content = $content -replace 'app\.get\("/api/companies/:id/leads",', 'app.get("/api/companies/:id/leads", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/companies",', 'app.post("/api/companies", isAdmin,'
$content = $content -replace 'app\.patch\("/api/companies/:id",', 'app.patch("/api/companies/:id", isAdmin,'
$content = $content -replace 'app\.delete\("/api/companies/:id",', 'app.delete("/api/companies/:id", isAdmin,'

# Config routes (admin only)
$content = $content -replace 'app\.get\("/api/config",', 'app.get("/api/config", isAdmin,'
$content = $content -replace 'app\.post\("/api/config",', 'app.post("/api/config", isAdmin,'

# Inventory routes
$content = $content -replace 'app\.get\("/api/inventory",', 'app.get("/api/inventory", isAuthenticated,'
$content = $content -replace 'app\.get\("/api/inventory/:id",', 'app.get("/api/inventory/:id", isAuthenticated,'
$content = $content -replace 'app\.post\("/api/inventory",', 'app.post("/api/inventory", isAdmin,'
$content = $content -replace 'app\.put\("/api/inventory/:id",', 'app.put("/api/inventory/:id", isAdmin,'
$content = $content -replace 'app\.delete\("/api/inventory/:id",', 'app.delete("/api/inventory/:id", isAdmin,'
$content = $content -replace 'app\.post\("/api/inventory/bulk-delete",', 'app.post("/api/inventory/bulk-delete", isAdmin,'
$content = $content -replace 'app\.post\("/api/inventory/import",', 'app.post("/api/inventory/import", isAdmin,'

# Import routes
$content = $content -replace 'app\.post\("/api/import/file",', 'app.post("/api/import/file", isAdmin,'

# Migration routes (admin only)
$content = $content -replace 'app\.post\("/api/migrate-inventory",', 'app.post("/api/migrate-inventory", isAdmin,'
$content = $content -replace 'app\.post\("/api/migrate/add-notes-to-leads",', 'app.post("/api/migrate/add-notes-to-leads", isAdmin,'
$content = $content -replace 'app\.post\("/api/migrate/inventory-schema",', 'app.post("/api/migrate/inventory-schema", isAdmin,'

Set-Content $routesFile $content

Write-Host "✅ Successfully added authentication middleware to all protected routes"
Write-Host ""
Write-Host "Summary:"
Write-Host "  - isAuthenticated: Standard user access (view/edit data)"
Write-Host "  - isAdmin: Admin-only access (delete, config, migrations)"
