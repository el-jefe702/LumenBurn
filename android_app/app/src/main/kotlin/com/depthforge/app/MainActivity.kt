package com.depthforge.app

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.*
import java.util.UUID

// --- Theme Colors ---
val DarkBackground = Color(0xFF121212)
val CardBackground = Color(0xFF1E1E24)
val TextPrimary = Color(0xFFFFFFFF)
val TextSecondary = Color(0xFFB0B0C0)
val GoldAccent = Color(0xFFD4AF37)
val OrangeAccent = Color(0xFFFF6B35)
val IndigoAccent = Color(0xFF6366F1)
val EmeraldAccent = Color(0xFF10B981)
val GrayBorder = Color(0xFF374151)

enum class Screen {
    Landing,
    MainMenu,
    TheForge,
    SupportAI,
    AdminDashboard
}

class MainActivity : ComponentActivity() {
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("depthforge_prefs", Context.MODE_PRIVATE)

        // Sync Base URL with preferences
        val savedUrl = prefs.getString("server_url", "http://10.0.2.2:8000/") ?: "http://10.0.2.2:8000/"
        ApiClient.baseUrl = savedUrl

        setContent {
            DepthForgeTheme {
                MainAppScaffold(prefs)
            }
        }
    }
}

@Composable
fun DepthForgeTheme(content: @Composable () -> Unit) {
    val colors = darkColors(
        primary = GoldAccent,
        primaryVariant = OrangeAccent,
        secondary = IndigoAccent,
        background = DarkBackground,
        surface = CardBackground,
        onPrimary = Color.Black,
        onSecondary = Color.White,
        onBackground = TextPrimary,
        onSurface = TextPrimary
    )
    MaterialTheme(
        colors = colors,
        content = content
    )
}

@Composable
fun MainAppScaffold(prefs: SharedPreferences) {
    val initialScreen = if (prefs.getBoolean("lead_submitted", false)) Screen.MainMenu else Screen.Landing
    var currentScreen by remember { mutableStateOf(initialScreen) }
    var showSettings by remember { mutableStateOf(false) }
    var serverUrlInput by remember { mutableStateOf(ApiClient.baseUrl) }

    // SharedPreferences values
    var userName by remember { mutableStateOf(prefs.getString("user_name", "") ?: "") }
    var userEmail by remember { mutableStateOf(prefs.getString("user_email", "") ?: "") }
    var premiumInterest by remember { mutableStateOf(prefs.getBoolean("premium_interest", false)) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        Crossfade(targetState = currentScreen, label = "ScreenTransition") { screen ->
            when (screen) {
                Screen.Landing -> LandingScreen(
                    userName = userName,
                    userEmail = userEmail,
                    premiumInterest = premiumInterest,
                    onLeadSubmitted = { name, email, interest ->
                        userName = name
                        userEmail = email
                        premiumInterest = interest
                        prefs.edit()
                            .putString("user_name", name)
                            .putString("user_email", email)
                            .putBoolean("premium_interest", interest)
                            .putBoolean("lead_submitted", true)
                            .apply()
                        currentScreen = Screen.MainMenu
                    },
                    onSkip = {
                        currentScreen = Screen.MainMenu
                    },
                    onOpenSettings = { showSettings = true }
                )
                Screen.MainMenu -> MainMenuScreen(
                    onNavigateToScreen = { currentScreen = it },
                    onOpenSettings = { showSettings = true }
                )
                Screen.TheForge -> TheForgeScreen(
                    defaultStudentName = userName,
                    onBackToMenu = { currentScreen = Screen.MainMenu },
                    onOpenSettings = { showSettings = true }
                )
                Screen.SupportAI -> SupportAIScreen(
                    prefs = prefs,
                    onBackToMenu = { currentScreen = Screen.MainMenu },
                    onOpenSettings = { showSettings = true }
                )
                Screen.AdminDashboard -> AdminDashboardScreen(
                    onBackToMenu = { currentScreen = Screen.MainMenu },
                    onOpenSettings = { showSettings = true }
                )
            }
        }

        // Settings Dialog
        if (showSettings) {
            Dialog(onDismissRequest = { showSettings = false }) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = CardBackground,
                    border = BorderStroke(1.dp, GrayBorder),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .padding(20.dp)
                            .fillMaxWidth()
                    ) {
                        Text(
                            text = "Settings",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Serif
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        Text("Server Address URL", color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = serverUrlInput,
                            onValueChange = { serverUrlInput = it },
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = Color.White,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Emulator default is http://10.0.2.2:8000/\nPhysical device uses your LAN IP (e.g. http://192.168.1.100:8000/)",
                            color = TextSecondary,
                            fontSize = 10.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))
                        Divider(color = GrayBorder)
                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                prefs.edit().clear().apply()
                                userName = ""
                                userEmail = ""
                                premiumInterest = false
                                ApiClient.baseUrl = "http://10.0.2.2:8000/"
                                serverUrlInput = ApiClient.baseUrl
                                currentScreen = Screen.Landing
                                showSettings = false
                            },
                            colors = ButtonDefaults.buttonColors(backgroundColor = OrangeAccent),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Reset App State", color = Color.White, fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            horizontalArrangement = Arrangement.End,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            TextButton(onClick = { showSettings = false }) {
                                Text("Cancel", color = TextSecondary)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    ApiClient.baseUrl = serverUrlInput
                                    prefs.edit().putString("server_url", serverUrlInput).apply()
                                    showSettings = false
                                },
                                colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent)
                            ) {
                                Text("Save", color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- LANDING SCREEN ---
@Composable
fun LandingScreen(
    userName: String,
    userEmail: String,
    premiumInterest: Boolean,
    onLeadSubmitted: (String, String, Boolean) -> Unit,
    onSkip: () -> Unit,
    onOpenSettings: () -> Unit
) {
    var showLeadModal by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Form states
    var nameVal by remember { mutableStateOf(userName) }
    var emailVal by remember { mutableStateOf(userEmail) }
    var premiumCheck by remember { mutableStateOf(premiumInterest) }
    var isSubmitting by remember { mutableStateOf(false) }

    // Pulsing text animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable { showLeadModal = true }
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Settings Icon Top-Right
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight(),
                contentAlignment = Alignment.TopEnd
            ) {
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
                }
            }
            Spacer(modifier = Modifier.weight(1f))

            // Logo Placeholder/Visual representation
            Box(
                modifier = Modifier
                    .size(130.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF1F1F26))
                    .border(2.dp, GoldAccent, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                // We attempt to download the logo, or display a stylized letter
                NetworkImage(
                    url = "/static/logo.png",
                    modifier = Modifier.fillMaxSize()
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "DepthForge",
                color = Color.White,
                fontSize = 42.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                textAlign = TextAlign.Center
            )

            Text(
                text = "3D Relief Assistant",
                color = TextSecondary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(48.dp))

            Divider(color = GrayBorder, modifier = Modifier.width(180.dp))
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Presented by",
                color = TextSecondary,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
            Text(
                text = "SLCreations, LLC",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.weight(1.2f))

            Text(
                text = "- Click Anywhere To Begin -",
                color = GoldAccent,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.alpha(pulseAlpha)
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Lead Modal
        if (showLeadModal) {
            Dialog(onDismissRequest = { if (!isSubmitting) showLeadModal = false }) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = CardBackground,
                    border = BorderStroke(1.dp, GrayBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .padding(24.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Join Our Community",
                                color = Color.White,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Serif
                            )
                            IconButton(onClick = { if (!isSubmitting) showLeadModal = false }) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary)
                            }
                        }

                        Text(
                            text = "Please add yourself to our mailing list to continue.",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.height(20.dp))

                        Text("Full Name *", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = nameVal,
                            onValueChange = { nameVal = it },
                            placeholder = { Text("Your Name", color = Color.Gray) },
                            singleLine = true,
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = Color.White,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Text("Email Address *", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = emailVal,
                            onValueChange = { emailVal = it },
                            placeholder = { Text("email@example.com", color = Color.Gray) },
                            singleLine = true,
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = Color.White,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "* Disclaimer: We promise to never sell your info or spam you.",
                            color = TextSecondary,
                            fontSize = 9.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Premium interest check box
                        Row(
                            verticalAlignment = Alignment.Top,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF121217), RoundedCornerShape(8.dp))
                                .border(1.dp, GrayBorder, RoundedCornerShape(8.dp))
                                .clickable { premiumCheck = !premiumCheck }
                                .padding(12.dp)
                        ) {
                            Checkbox(
                                checked = premiumCheck,
                                onCheckedChange = { premiumCheck = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = GoldAccent,
                                    uncheckedColor = TextSecondary,
                                    checkmarkColor = Color.Black
                                )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "Interested in the Pro Version?",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                               )
                                Text(
                                    text = "Check here for info on using DepthForge for personal projects outside of class.",
                                    color = TextSecondary,
                                    fontSize = 10.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            OutlinedButton(
                                onClick = {
                                    showLeadModal = false
                                    onSkip()
                                },
                                border = BorderStroke(1.dp, GrayBorder),
                                colors = ButtonDefaults.outlinedButtonColors(backgroundColor = Color.Transparent),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Skip", color = TextSecondary)
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Button(
                                onClick = {
                                    if (nameVal.isBlank() || emailVal.isBlank()) {
                                        return@Button
                                    }
                                    isSubmitting = true
                                    scope.launch {
                                        try {
                                            ApiClient.submitLead(nameVal, emailVal, premiumCheck)
                                            onLeadSubmitted(nameVal, emailVal, premiumCheck)
                                        } catch (e: Exception) {
                                            Log.e("Lead", "Lead submission failed, bypass: ${e.message}")
                                            // Bypass on connection failure so user can still access menu in offline mode
                                            onLeadSubmitted(nameVal, emailVal, premiumCheck)
                                        } finally {
                                            isSubmitting = false
                                            showLeadModal = false
                                        }
                                    }
                                },
                                enabled = nameVal.isNotBlank() && emailVal.isNotBlank() && !isSubmitting,
                                colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent),
                                modifier = Modifier.weight(1.5f)
                            ) {
                                if (isSubmitting) {
                                    CircularProgressIndicator(color = Color.Black, modifier = Modifier.size(16.dp))
                                } else {
                                    Text("Enter Forge", color = Color.Black, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- MAIN MENU SCREEN ---
@Composable
fun MainMenuScreen(
    onNavigateToScreen: (Screen) -> Unit,
    onOpenSettings: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Custom Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1A1A22))
                ) {
                    NetworkImage(url = "/static/logo.png", modifier = Modifier.fillMaxSize())
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "DepthForge",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
            }

            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
            }
        }

        Divider(color = GrayBorder)
        Spacer(modifier = Modifier.height(24.dp))

        // Screen Main Title
        Text(
            text = "Main Menu",
            color = Color.White,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Serif
        )
        Text(
            text = "3D Relief Assistant",
            color = TextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 4.0.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Navigation Grid/Cards
        // Card 1: The Forge
        MenuCard(
            title = "The Forge",
            description = "Generate flawless 16-bit 3D relief depth maps optimized for the OmTech 100W CO2 laser. Perfect for bespoke signs and magnets.",
            icon = Icons.Default.Build,
            accentColor = GoldAccent,
            onClick = { onNavigateToScreen(Screen.TheForge) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Card 2: Support AI
        MenuCard(
            title = "Support AI",
            description = "Access the intelligent SLCreations studio assistant. Get instant help with laser settings, material constraints, and app troubleshooting.",
            icon = Icons.Default.Email,
            accentColor = IndigoAccent,
            onClick = { onNavigateToScreen(Screen.SupportAI) }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Card 3: Admin Panel
        MenuCard(
            title = "Admin Panel",
            description = "Manage the student submission queue, view sign-up leads, and open generated LightBurn project files directly on the laser host.",
            icon = Icons.Default.Person,
            accentColor = OrangeAccent,
            onClick = { onNavigateToScreen(Screen.AdminDashboard) }
        )

        Spacer(modifier = Modifier.weight(1f))
        Spacer(modifier = Modifier.height(32.dp))

        Divider(color = GrayBorder)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "SLCreations, LLC © 2026",
            color = TextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun MenuCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        backgroundColor = CardBackground,
        border = BorderStroke(1.dp, GrayBorder),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(Color(0xFF121217), RoundedCornerShape(8.dp))
                        .padding(10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = icon, contentDescription = title, tint = accentColor)
                }
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = description,
                color = TextSecondary,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )
        }
    }
}

// --- THE FORGE SCREEN ---
@Composable
fun TheForgeScreen(
    defaultStudentName: String,
    onBackToMenu: () -> Unit,
    onOpenSettings: () -> Unit
) {
    var promptInput by remember { mutableStateOf("") }
    var currentImageUrl by remember { mutableStateOf("") }
    var isPolished by remember { mutableStateOf(false) }
    var isGenerating by remember { mutableStateOf(false) }
    var isPolishing by remember { mutableStateOf(false) }
    var lastError by remember { mutableStateOf<String?>(null) }

    // Queue button states
    var isSentToQueue by remember { mutableStateOf(false) }
    var showQueueNameDialog by remember { mutableStateOf(false) }
    var studentNameInput by remember { mutableStateOf(defaultStudentName) }

    // Direct Laser states
    var showSafetyDialog by remember { mutableStateOf(false) }
    var safety1 by remember { mutableStateOf(false) }
    var safety2 by remember { mutableStateOf(false) }
    var safetyConfirmText by remember { mutableStateOf("") }
    var showJobMonitor by remember { mutableStateOf(false) }
    var currentJobId by remember { mutableStateOf("") }

    // Post-processing pipeline step animation index
    var activePolishStep by remember { mutableIntStateOf(-1) }

    // 3D Preview states
    var show3DPreview by remember { mutableStateOf(false) }
    var currentGlbUrl by remember { mutableStateOf("") }
    var isCompiling3d by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackToMenu) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextSecondary)
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "DepthForge",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
            }

            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
            }
        }

        Divider(color = GrayBorder)
        Spacer(modifier = Modifier.height(16.dp))

        // Main Layout: Parameters Card
        Card(
            shape = RoundedCornerShape(12.dp),
            backgroundColor = CardBackground,
            border = BorderStroke(1.dp, GrayBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Carve Parameters",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
                Spacer(modifier = Modifier.height(12.dp))

                Text("What do you want to carve?", color = TextSecondary, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = promptInput,
                    onValueChange = { promptInput = it },
                    placeholder = { Text("e.g. A solitary pine tree on a hill...", color = Color.Gray) },
                    colors = TextFieldDefaults.outlinedTextFieldColors(
                        textColor = Color.White,
                        focusedBorderColor = GoldAccent,
                        unfocusedBorderColor = GrayBorder
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        if (promptInput.isBlank()) return@Button
                        isGenerating = true
                        lastError = null
                        currentImageUrl = ""
                        isPolished = false
                        isSentToQueue = false
                        show3DPreview = false
                        currentGlbUrl = ""
                        scope.launch {
                            try {
                                val result = ApiClient.generate(promptInput)
                                if (result["status"] == "success") {
                                    currentImageUrl = result["image_url"] as? String ?: ""
                                } else {
                                    lastError = "Server Error: ${result["message"] ?: "Unknown failure"}"
                                    Log.e("Forge", "Server failed to generate")
                                }
                            } catch (e: Exception) {
                                lastError = "Connection Error: ${e.message}"
                                Log.e("Forge", "Generate failed: ${e.message}")
                            } finally {
                                isGenerating = false
                            }
                        }
                    },
                    enabled = promptInput.isNotBlank() && !isGenerating,
                    colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Ignite Forge", color = Color.Black, fontWeight = FontWeight.Bold)






























































































































































































































































































































































































































































































































































































                }

                if (lastError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = lastError!!,
                        color = Color.Red,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Constraints card
        Card(
            shape = RoundedCornerShape(12.dp),
            backgroundColor = Color(0xFF15151A),
            border = BorderStroke(1.dp, GrayBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text("Class Constraints", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                Text("• Size Limits: Physical output is restricted to 2x2\" or 4x4\" stock.", color = TextSecondary, fontSize = 11.sp)
                Text("• Complexity: System automatically smooths details. Keep design bold.", color = TextSecondary, fontSize = 11.sp)
                Text("• Scale: Simple, single objects work much better than busy scenes.", color = TextSecondary, fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Preview & Outputs Card
        Card(
            shape = RoundedCornerShape(12.dp),
            backgroundColor = CardBackground,
            border = BorderStroke(1.dp, GrayBorder),
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp),
            contentColor = Color.White
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                if (currentImageUrl.isBlank() && !isGenerating && !isPolishing) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Waiting",
                            tint = Color.Gray,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Awaiting Input Parameters",
                            color = Color.Gray,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else if (isGenerating) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f))
                    ) {
                        CircularProgressIndicator(color = GoldAccent)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Forging Map in the Cloud...", color = Color.White, fontSize = 14.sp)
                        Text("(This takes a few seconds)", color = TextSecondary, fontSize = 10.sp)
                    }
                } else if (isPolishing) {
                    // Pipeline Overlay Animation
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.9f))
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "Post-Processing Pipeline",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        val stepsList = listOf(
                            "Upscaling: Promotes 8-bit depth map to high-precision 16-bit space.",
                            "Inpainting: Bridges hollow pixels and sudden drops.",
                            "Filtering: Heavy bilateral filter to remove stair-stepping.",
                            "Normalization: Maximizes physical Z-axis depth variance.",
                            "Lossless Export: Saves optimized, compressed forge_...png."
                        )

                        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(5) { i ->
                                val active = i == activePolishStep
                                val completed = i < activePolishStep
                                Row(
                                    verticalAlignment = Alignment.Top,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            if (active) Color(0xFF26263A) else Color.Transparent,
                                            RoundedCornerShape(4.dp)
                                        )
                                        .border(
                                            width = if (active) 1.dp else 0.dp,
                                            color = if (active) GoldAccent else Color.Transparent,
                                            shape = RoundedCornerShape(4.dp)
                                        )
                                        .padding(6.dp)
                                ) {
                                    Text(
                                        text = if (completed) "✔️" else if (active) "🔥" else "•",
                                        color = if (active) GoldAccent else if (completed) EmeraldAccent else Color.Gray,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = stepsList[i],
                                        color = if (active) Color.White else if (completed) TextSecondary else Color.Gray,
                                        fontSize = 10.sp,
                                        lineHeight = 12.sp
                                    )
                                }
                            }
                        }
                    }
                } else if (isCompiling3d) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.8f))
                    ) {
                        CircularProgressIndicator(color = GoldAccent)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Compiling 3D Mesh...", color = Color.White, fontSize = 14.sp)
                        Text("(Sending to SpatialScrap)", color = TextSecondary, fontSize = 10.sp)
                    }
                } else if (show3DPreview && currentGlbUrl.isNotBlank()) {
                    GlbModelViewer(
                        glbUrl = currentGlbUrl,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    NetworkImage(
                        url = currentImageUrl,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // 2D/3D View Toggle
                if (currentImageUrl.isNotBlank() && !isGenerating && !isPolishing && !isCompiling3d) {
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .background(Color.Black.copy(alpha = 0.7f), RoundedCornerShape(20.dp))
                            .border(1.dp, GrayBorder, RoundedCornerShape(20.dp))
                            .padding(2.dp),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Button(
                            onClick = { show3DPreview = false },
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (!show3DPreview) Color.White else Color.Transparent
                            ),
                            elevation = ButtonDefaults.elevation(0.dp, 0.dp, 0.dp),
                            shape = RoundedCornerShape(18.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text(
                                "2D Map",
                                color = if (!show3DPreview) Color.Black else Color.Gray,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(2.dp))
                        Button(
                            onClick = {
                                if (currentGlbUrl.isBlank()) {
                                    isCompiling3d = true
                                    scope.launch {
                                        try {
                                            val result = ApiClient.preview3d(currentImageUrl)
                                            if (result["status"] == "success") {
                                                currentGlbUrl = result["glb_url"] as? String ?: ""
                                                show3DPreview = true
                                            } else {
                                                lastError = "3D mesh compilation failed."
                                            }
                                        } catch (e: Exception) {
                                            lastError = "3D Error: ${e.message}"
                                            Log.e("Forge", "3D preview failed: ${e.message}")
                                        } finally {
                                            isCompiling3d = false
                                        }
                                    }
                                } else {
                                    show3DPreview = true
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (show3DPreview) Color.White else Color.Transparent
                            ),
                            elevation = ButtonDefaults.elevation(0.dp, 0.dp, 0.dp),
                            shape = RoundedCornerShape(18.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text(
                                "3D Mesh",
                                color = if (show3DPreview) Color.Black else Color.Gray,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Action Buttons below Preview
        if (currentImageUrl.isNotBlank() && !isGenerating && !isPolishing) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = {
                        currentImageUrl = ""
                        isPolished = false
                        isSentToQueue = false
                        show3DPreview = false
                        currentGlbUrl = ""
                    },
                    colors = ButtonDefaults.buttonColors(backgroundColor = Color.DarkGray),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Discard", color = Color.White)
                }

                Spacer(modifier = Modifier.width(12.dp))

                if (!isPolished) {
                    Button(
                        onClick = {
                            isPolishing = true
                            activePolishStep = 0
                            scope.launch {
                                // Background API call
                                val polishJob = async {
                                    try {
                                        ApiClient.postprocess(currentImageUrl)
                                    } catch (e: Exception) {
                                        null
                                    }
                                }

                                // Animate step-by-step
                                for (step in 0..4) {
                                    activePolishStep = step
                                    delay(1800)
                                }

                                val data = polishJob.await()
                                if (data != null && data["status"] == "success") {
                                    currentImageUrl = data["image_url"] as? String ?: currentImageUrl
                                    isPolished = true
                                    show3DPreview = false
                                    currentGlbUrl = ""
                                }
                                isPolishing = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(backgroundColor = IndigoAccent),
                        modifier = Modifier.weight(1.5f)
                    ) {
                        Text("✨ Polish for CNC", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                } else {
                    // Polished Actions
                    Column(modifier = Modifier.weight(1.5f)) {
                        Button(
                            onClick = { showQueueNameDialog = true },
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (isSentToQueue) EmeraldAccent else OrangeAccent
                            ),
                            enabled = !isSentToQueue,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (isSentToQueue) "✔️ Sent to Admin" else "🔥 Send to Admin Queue",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Launcher direct button
                        Button(
                            onClick = { showSafetyDialog = true },
                            colors = ButtonDefaults.buttonColors(backgroundColor = OrangeAccent),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Launch", tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Launch Laser Direct", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }

        // Student Queue Dialog
        if (showQueueNameDialog) {
            Dialog(onDismissRequest = { showQueueNameDialog = false }) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = CardBackground,
                    border = BorderStroke(1.dp, GrayBorder),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "Admin Laser Queue",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Serif
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        Text("Enter your name for the queue:", color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = studentNameInput,
                            onValueChange = { studentNameInput = it },
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = Color.White,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            horizontalArrangement = Arrangement.End,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            TextButton(onClick = { showQueueNameDialog = false }) {
                                Text("Cancel", color = TextSecondary)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    if (studentNameInput.isBlank()) return@Button
                                    showQueueNameDialog = false
                                    scope.launch {
                                        try {
                                            val resp = ApiClient.sendToAdminQueue(currentImageUrl, studentNameInput)
                                            if (resp["status"] == "success") {
                                                isSentToQueue = true
                                            }
                                        } catch (e: Exception) {
                                            Log.e("Queue", "Send failed: ${e.message}")
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent)
                            ) {
                                Text("Send", color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Direct Laser Safety Confirmation Dialog
        if (showSafetyDialog) {
            Dialog(onDismissRequest = { showSafetyDialog = false }) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = CardBackground,
                    border = BorderStroke(1.dp, GrayBorder),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .padding(20.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = "Safety Alert", tint = OrangeAccent)
                            Text(
                                text = "Safety Protocols",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Serif
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = "Engraving requires confirmation of direct safety measures before starting the CNC spindle/laser hardware.",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            lineHeight = 14.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = safety1,
                                onCheckedChange = { safety1 = it },
                                colors = CheckboxDefaults.colors(checkedColor = GoldAccent)
                            )
                            Text("Laser path is clear of obstructions", color = Color.White, fontSize = 11.sp)
                        }
                        Spacer(modifier = Modifier.height(6.dp))

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = safety2,
                                onCheckedChange = { safety2 = it },
                                colors = CheckboxDefaults.colors(checkedColor = GoldAccent)
                            )
                            Text("Exhaust fan is running & venting", color = Color.White, fontSize = 11.sp)
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "To authorize operation, type CONFIRM below:",
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = safetyConfirmText,
                            onValueChange = { safetyConfirmText = it },
                            placeholder = { Text("CONFIRM", color = Color.DarkGray) },
                            singleLine = true,
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = Color.White,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Row(
                            horizontalArrangement = Arrangement.End,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            TextButton(onClick = { showSafetyDialog = false }) {
                                Text("Cancel", color = TextSecondary)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    if (!safety1 || !safety2 || safetyConfirmText != "CONFIRM") return@Button
                                    showSafetyDialog = false
                                    scope.launch {
                                        try {
                                            val jobId = ApiClient.prepareLaser(currentImageUrl)
                                            if (jobId.isNotBlank()) {
                                                currentJobId = jobId
                                                ApiClient.launchLaser(jobId, safetyConfirmed = true)
                                                showJobMonitor = true
                                            }
                                        } catch (e: Exception) {
                                            Log.e("Laser", "Direct fire failed: ${e.message}")
                                        }
                                    }
                                },
                                enabled = safety1 && safety2 && safetyConfirmText == "CONFIRM",
                                colors = ButtonDefaults.buttonColors(backgroundColor = OrangeAccent)
                            ) {
                                Text("Fire Spindle", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Spindle/Laser Job Monitoring Dialog (WebSocket + Fallback Polling)
        if (showJobMonitor) {
            var progressPercent by remember { mutableStateOf(0) }
            var statusText by remember { mutableStateOf("Initializing connection...") }
            var isConnecting by remember { mutableStateOf(true) }

            // Active listener connection logic
            LaunchedEffect(currentJobId) {
                isConnecting = true
                progressPercent = 0
                statusText = "Connecting to job monitoring socket..."

                // WS Path setup
                val wsPath = ApiClient.baseUrl
                    .replace("http://", "ws://")
                    .replace("https://", "wss://")
                    .removeSuffix("/") + "/ws"

                val ws = WebSocketManager(wsPath)

                // Polling job to run in case WebSocket misses updates
                var jobFinished = false
                val pollingJob = launch {
                    while (!jobFinished) {
                        try {
                            delay(1200)
                            val statusResp = ApiClient.getStatus(currentJobId)
                            val jobObj = statusResp["job"] as? Map<String, Any>
                            if (jobObj != null) {
                                val status = jobObj["status"] as? String ?: ""
                                val progressVal = (jobObj["progress"] as? Number)?.toInt() ?: 0
                                progressPercent = progressVal
                                statusText = "Laser engraving active: ${status.capitalize()}"

                                if (status == "completed" || status == "error" || progressVal >= 100) {
                                    jobFinished = true
                                    isConnecting = false
                                    statusText = if (status == "completed" || progressVal >= 100) "✔️ Engraving complete!" else "⚠️ Engagement failure!"
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("JobMonitor", "Status polling error: ${e.message}")
                        }
                    }
                }

                try {
                    ws.connect(
                        onOpen = {
                            isConnecting = false
                            statusText = "Monitoring connection established."
                        },
                        onJobUpdate = { jobMap ->
                            val status = jobMap["status"] as? String ?: ""
                            val progress = (jobMap["progress"] as? Number)?.toInt() ?: 0
                            progressPercent = progress
                            statusText = "Engraving job streaming: ${status.capitalize()}"

                            if (status == "completed" || progress >= 100) {
                                jobFinished = true
                                isConnecting = false
                                statusText = "✔️ Laser spindle finished engraving successfully!"
                                pollingJob.cancel()
                            } else if (status == "error") {
                                jobFinished = true
                                isConnecting = false
                                statusText = "⚠️ Hardware failure: ${jobMap["error"] ?: "Engraving cancelled"}"
                                pollingJob.cancel()
                            }
                        },
                        onFailure = {
                            // Suppress failure and fallback to the background polling
                            Log.i("JobMonitor", "WebSocket failure, continuing with backup HTTP polling.")
                        }
                    )
                } catch (e: Exception) {
                    Log.w("JobMonitor", "WS socket failed: ${e.message}")
                }
            }

            Dialog(onDismissRequest = { }) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = CardBackground,
                    border = BorderStroke(1.dp, GrayBorder),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Text(
                            text = "Laser Spindle Monitor",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Serif
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        if (isConnecting) {
                            CircularProgressIndicator(color = GoldAccent, modifier = Modifier.size(32.dp))
                        } else {
                            Text(
                                text = "$progressPercent%",
                                color = GoldAccent,
                                fontSize = 36.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        // Progress bar representation
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .background(Color.DarkGray, RoundedCornerShape(4.dp))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .fillMaxWidth(progressPercent / 100f)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(OrangeAccent, GoldAccent)
                                        ),
                                        RoundedCornerShape(4.dp)
                                    )
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = statusText,
                            color = TextSecondary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { showJobMonitor = false },
                            colors = ButtonDefaults.buttonColors(backgroundColor = Color.DarkGray),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Dismiss Monitor", color = Color.White)
                        }
                    }
                }
            }
        }
    }
}

// --- SUPPORT AI SCREEN ---
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val sender: String, // "AI" or "USER"
    val content: String
)

@Composable
fun SupportAIScreen(
    prefs: SharedPreferences,
    onBackToMenu: () -> Unit,
    onOpenSettings: () -> Unit
) {
    var messageInput by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            ChatMessage(
                sender = "AI",
                content = "Hello! I'm the SLCreations assistant. How can I help you today?"
            )
        )
    }
    var isSending by remember { mutableStateOf(false) }
    val lazyListState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Session ID setup
    val sessionId = remember {
        var savedId = prefs.getString("chat_session_id", "") ?: ""
        if (savedId.isBlank()) {
            savedId = "sess-" + System.currentTimeMillis()
            prefs.edit().putString("chat_session_id", savedId).apply()
        }
        savedId
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackToMenu) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextSecondary)
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Support AI",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
            }

            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
            }
        }

        Divider(color = GrayBorder, modifier = Modifier.padding(vertical = 8.dp))

        // Chat conversation list
        LazyColumn(
            state = lazyListState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { msg ->
                val isUser = msg.sender == "USER"
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
                ) {
                    Box(
                        modifier = Modifier
                            .clip(
                                RoundedCornerShape(
                                    topStart = 12.dp,
                                    topEnd = 12.dp,
                                    bottomStart = if (isUser) 12.dp else 2.dp,
                                    bottomEnd = if (isUser) 2.dp else 12.dp
                                )
                            )
                            .background(if (isUser) IndigoAccent else CardBackground)
                            .border(
                                1.dp,
                                if (isUser) Color.Transparent else GrayBorder,
                                RoundedCornerShape(
                                    topStart = 12.dp,
                                    topEnd = 12.dp,
                                    bottomStart = if (isUser) 12.dp else 2.dp,
                                    bottomEnd = if (isUser) 2.dp else 12.dp
                                )
                            )
                            .padding(14.dp)
                            .widthIn(max = 270.dp)
                    ) {
                        Text(
                            text = msg.content,
                            color = Color.White,
                            fontSize = 13.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            if (isSending) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.Start
                    ) {
                        CircularProgressIndicator(
                            color = GoldAccent,
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Thinking...",
                            color = TextSecondary,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.SansSerif
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Bottom text field
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF16161C), RoundedCornerShape(24.dp))
                .border(1.dp, GrayBorder, RoundedCornerShape(24.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            OutlinedTextField(
                value = messageInput,
                onValueChange = { messageInput = it },
                placeholder = { Text("Ask a question...", color = Color.Gray, fontSize = 13.sp) },
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    textColor = Color.White,
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent
                ),
                maxLines = 3,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp)
            )

            IconButton(
                onClick = {
                    if (messageInput.isBlank()) return@IconButton
                    val userTxt = messageInput.trim()
                    messages.add(ChatMessage(sender = "USER", content = userTxt))
                    messageInput = ""
                    isSending = true
                    scope.launch {
                        // Scroll list to bottom
                        lazyListState.animateScrollToItem(messages.size - 1)
                        try {
                            val resp = ApiClient.chat(userTxt, sessionId)
                            val reply = resp["reply"] as? String ?: "Network Error: Empty reply"
                            messages.add(ChatMessage(sender = "AI", content = reply))
                        } catch (e: Exception) {
                            messages.add(ChatMessage(sender = "AI", content = "Support offline: ${e.message}"))
                        } finally {
                            isSending = false
                            lazyListState.animateScrollToItem(messages.size - 1)
                        }
                    }
                },
                enabled = messageInput.isNotBlank() && !isSending
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = if (messageInput.isNotBlank()) GoldAccent else Color.Gray
                )
            }
        }
    }
}

// --- ADMIN DASHBOARD SCREEN ---
@Composable
fun AdminDashboardScreen(
    onBackToMenu: () -> Unit,
    onOpenSettings: () -> Unit
) {
    var activeTab by remember { mutableStateOf(0) } // 0 = Queue, 1 = Sign-ups
    val scope = rememberCoroutineScope()

    var queueItems by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var leadItems by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }

    fun refreshData() {
        isLoading = true
        scope.launch {
            try {
                if (activeTab == 0) {
                    val rawQueue = ApiClient.getQueue()
                    queueItems = rawQueue
                } else {
                    val rawLeads = ApiClient.getLeads()
                    leadItems = rawLeads
                }
            } catch (e: Exception) {
                Log.e("Admin", "Failed to fetch dashboard data: ${e.message}")
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(activeTab) {
        refreshData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackToMenu) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextSecondary)
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Admin Panel",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
            }

            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
            }
        }

        Divider(color = GrayBorder, modifier = Modifier.padding(vertical = 4.dp))

        // Tabs
        TabRow(
            selectedTabIndex = activeTab,
            backgroundColor = Color.Transparent,
            contentColor = GoldAccent
        ) {
            Tab(
                selected = activeTab == 0,
                onClick = { activeTab = 0 },
                text = { Text("Student Queue", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
            )
            Tab(
                selected = activeTab == 1,
                onClick = { activeTab = 1 },
                text = { Text("Login Leads", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Actions Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { refreshData() }, enabled = !isLoading) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = GoldAccent)
            }
        }

        // List Display
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = GoldAccent)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (activeTab == 0) {
                    if (queueItems.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Queue is currently empty.", color = Color.Gray, fontSize = 13.sp)
                            }
                        }
                    } else {
                        items(queueItems) { item ->
                            val studentName = item["studentName"] as? String ?: "Anonymous"
                            val fileName = item["lbrn2Filename"] as? String ?: "Unknown"
                            val imageUrl = item["imageUrl"] as? String ?: ""
                            var openedState by remember { mutableStateOf(false) }

                            Card(
                                shape = RoundedCornerShape(8.dp),
                                backgroundColor = CardBackground,
                                border = BorderStroke(1.dp, GrayBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(studentName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(fileName, color = Color.Gray, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                    }

                                    Spacer(modifier = Modifier.width(8.dp))

                                    Button(
                                        onClick = {
                                            openedState = true
                                            scope.launch {
                                                try {
                                                    ApiClient.openInLightburn(imageUrl)
                                                } catch (e: Exception) {
                                                    Log.e("Admin", "Open failed: ${e.message}")
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            backgroundColor = if (openedState) EmeraldAccent else IndigoAccent
                                        ),
                                        modifier = Modifier.wrapContentWidth()
                                    ) {
                                        Text(
                                            text = if (openedState) "✔️ Opened" else "Open in LB",
                                            color = Color.White,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                } else {
                    if (leadItems.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No sign-ups found.", color = Color.Gray, fontSize = 13.sp)
                            }
                        }
                    } else {
                        items(leadItems) { item ->
                            val name = item["name"] as? String ?: ""
                            val email = item["email"] as? String ?: ""
                            val timestamp = item["timestamp"] as? String ?: ""
                            val isPremium = (item["premium_interest"] == true || item["premium_interest"].toString() == "true")

                            Card(
                                shape = RoundedCornerShape(8.dp),
                                backgroundColor = CardBackground,
                                border = BorderStroke(1.dp, GrayBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        if (isPremium) {
                                            Text(
                                                "PRO INTEREST",
                                                color = GoldAccent,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 9.sp,
                                                modifier = Modifier
                                                    .background(Color(0xFF2E240D), RoundedCornerShape(4.dp))
                                                    .border(1.dp, GoldAccent, RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(email, color = TextSecondary, fontSize = 12.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(timestamp.substringBefore("T"), color = Color.Gray, fontSize = 9.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- HELPER COMPOSABLE FOR IMAGE LOADING ---
@Composable
fun NetworkImage(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit
) {
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    var isLoading by remember(url) { mutableStateOf(true) }
    var errorMessage by remember(url) { mutableStateOf<String?>(null) }

    LaunchedEffect(url) {
        if (url.isBlank()) {
            isLoading = false
            return@LaunchedEffect
        }
        isLoading = true
        errorMessage = null
        try {
            val imageBytes = ApiClient.downloadImage(url)
            if (imageBytes != null) {
                val decoded = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                if (decoded != null) {
                    bitmap = decoded
                } else {
                    errorMessage = "Bitmap decode failed"
                }
            } else {
                errorMessage = "Network download failed"
            }
        } catch (e: Exception) {
            Log.e("NetworkImage", "Error loading image: ${e.message}", e)
            errorMessage = e.message
        } finally {
            isLoading = false
        }
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (isLoading) {
            CircularProgressIndicator(color = GoldAccent, modifier = Modifier.size(24.dp))
        } else if (errorMessage != null || bitmap == null) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Error",
                    tint = Color.Red,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = errorMessage ?: "Unknown Error",
                    color = Color.Gray,
                    fontSize = 10.sp,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "URL: $url",
                    color = Color.DarkGray,
                    fontSize = 8.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1
                )
            }
        } else {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "DepthForge Image",
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale
            )
        }
    }
}

// --- 3D MODEL VIEWER (WebView-based) ---
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GlbModelViewer(
    glbUrl: String,
    modifier: Modifier = Modifier
) {
    val fullUrl = remember(glbUrl) {
        if (glbUrl.startsWith("http")) glbUrl
        else ApiClient.baseUrl.removeSuffix("/") + "/" + glbUrl.removePrefix("/")
    }

    key(fullUrl) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    webViewClient = WebViewClient()
                    setBackgroundColor(android.graphics.Color.parseColor("#121212"))

                    val html = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
                            <style>
                                body { margin: 0; background: #121212; overflow: hidden; }
                                model-viewer { width: 100%; height: 100vh; }
                            </style>
                        </head>
                        <body>
                            <model-viewer src="$fullUrl" 
                                camera-controls auto-rotate 
                                shadow-intensity="1"
                                style="width: 100%; height: 100vh; background-color: #121212;">
                            </model-viewer>
                        </body>
                        </html>
                    """.trimIndent()

                    loadDataWithBaseURL(
                        ApiClient.baseUrl,
                        html,
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            },
            modifier = modifier
        )
    }
}
