package com.depthforge.app

import android.content.ContentValues
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

val DarkBackground = Color(0xFF0A0A0F)
val CardBackground = Color(0xFF14141C)
val TextPrimary = Color(0xFFE8E8F0)
val TextSecondary = Color(0xFF8888A0)
val GoldAccent = Color(0xFFD4AF37)
val IndigoAccent = Color(0xFF6366F1)
val EmeraldAccent = Color(0xFF10B981)
val PinkAccent = Color(0xFFEC4899)
val GrayBorder = Color(0xFF2A2A3A)

@Composable
fun DepthForgeTheme(content: @Composable () -> Unit) {
    val colors = darkColors(
        primary = GoldAccent,
        primaryVariant = IndigoAccent,
        secondary = IndigoAccent,
        background = DarkBackground,
        surface = CardBackground,
        onPrimary = DarkBackground,
        onSecondary = TextPrimary,
        onBackground = TextPrimary,
        onSurface = TextPrimary,
    )
    MaterialTheme(
        colors = colors,
        content = content
    )
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("depthforge_prefs", Context.MODE_PRIVATE)
        ApiClient.baseUrl = prefs.getString("server_url", "http://4.3.2.122:8000/") ?: "http://4.3.2.122:8000/"
        setContent {
            DepthForgeTheme {
                ForgeApp(prefs)
            }
        }
    }
}

@Composable
fun ForgeApp(prefs: SharedPreferences) {
    var showSettings by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(DarkBackground)) {
        ForgeScreen(onOpenSettings = { showSettings = true })

        if (showSettings) {
            var serverUrlInput by remember { mutableStateOf(ApiClient.baseUrl) }
            Dialog(onDismissRequest = { showSettings = false }) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = CardBackground,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Settings", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedTextField(
                            value = serverUrlInput,
                            onValueChange = { serverUrlInput = it },
                            label = { Text("Server URL", color = TextSecondary) },
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = TextPrimary,
                                cursorColor = GoldAccent,
                                focusedBorderColor = GoldAccent,
                                unfocusedBorderColor = GrayBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            TextButton(onClick = { showSettings = false }) {
                                Text("Cancel", color = TextSecondary)
                            }
                            Button(
                                onClick = {
                                    ApiClient.baseUrl = serverUrlInput
                                    prefs.edit().putString("server_url", serverUrlInput).apply()
                                    showSettings = false
                                },
                                colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent)
                            ) {
                                Text("Save")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ForgeScreen(onOpenSettings: () -> Unit) {
    var promptInput by remember { mutableStateOf("") }
    var inputMode by remember { mutableStateOf("text") }
    var selectedPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var currentImageUrl by remember { mutableStateOf("") }
    var currentBitmap by remember { mutableStateOf<Bitmap?>(null) }
    
    var isGenerating by remember { mutableStateOf(false) }
    var isPolishing by remember { mutableStateOf(false) }
    var isPolished by remember { mutableStateOf(false) }
    var isRemovingBg by remember { mutableStateOf(false) }
    var bgRemoved by remember { mutableStateOf(false) }
    var lastError by remember { mutableStateOf<String?>(null) }
    var activePolishStep by remember { mutableStateOf(-1) }
    
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scaffoldState = rememberScaffoldState()

    val photoPickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        selectedPhotoUri = uri
    }

    Scaffold(
        scaffoldState = scaffoldState,
        backgroundColor = DarkBackground
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "DepthForge",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextPrimary)
                }
            }
            Divider(color = GrayBorder, modifier = Modifier.padding(vertical = 16.dp))

            // Input Card
            Card(
                backgroundColor = CardBackground,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GrayBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Carve Parameters", color = TextPrimary, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = { inputMode = "text" },
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (inputMode == "text") GoldAccent else CardBackground
                            ),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Text Prompt", color = if (inputMode == "text") DarkBackground else TextPrimary)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = { inputMode = "photo" },
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (inputMode == "photo") GoldAccent else CardBackground
                            ),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Upload Photo", color = if (inputMode == "photo") DarkBackground else TextPrimary)
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))

                    if (inputMode == "text") {
                        Text("What do you want to carve?", color = TextSecondary, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = promptInput,
                            onValueChange = { promptInput = it },
                            modifier = Modifier.fillMaxWidth().height(100.dp),
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                textColor = TextPrimary,
                                unfocusedBorderColor = GrayBorder,
                                focusedBorderColor = GoldAccent
                            )
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                if (promptInput.isNotBlank()) {
                                    isGenerating = true
                                    lastError = null
                                    currentImageUrl = ""
                                    currentBitmap = null
                                    isPolished = false
                                    bgRemoved = false
                                    
                                    coroutineScope.launch {
                                        try {
                                            val res = ApiClient.generate(promptInput)
                                            if (res.optString("status") == "success") {
                                                currentImageUrl = res.getString("image_url")
                                                currentBitmap = ApiClient.downloadImage(currentImageUrl)
                                            } else {
                                                lastError = "Generation failed"
                                            }
                                        } catch (e: Exception) {
                                            lastError = e.message ?: "Unknown error"
                                        } finally {
                                            isGenerating = false
                                        }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(backgroundColor = GoldAccent),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Ignite Forge")
                        }
                    } else {
                        Text("Upload a photo to convert to a depth map", color = TextSecondary, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { photoPickerLauncher.launch("image/*") },
                            colors = ButtonDefaults.buttonColors(backgroundColor = GrayBorder)
                        ) {
                            Text("Select Photo", color = TextPrimary)
                        }
                        if (selectedPhotoUri != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Photo Selected ✓", color = EmeraldAccent, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                selectedPhotoUri?.let { uri ->
                                    isGenerating = true
                                    lastError = null
                                    currentImageUrl = ""
                                    currentBitmap = null
                                    isPolished = false
                                    bgRemoved = false
                                    
                                    coroutineScope.launch {
                                        try {
                                            val tempFile = File(context.cacheDir, "upload_temp.jpg")
                                            context.contentResolver.openInputStream(uri)?.use { input ->
                                                FileOutputStream(tempFile).use { output ->
                                                    input.copyTo(output)
                                                }
                                            }
                                            val res = ApiClient.photoToDepth(tempFile)
                                            if (res.optString("status") == "success") {
                                                currentImageUrl = res.getString("image_url")
                                                currentBitmap = ApiClient.downloadImage(currentImageUrl)
                                            } else {
                                                lastError = "Conversion failed"
                                            }
                                        } catch (e: Exception) {
                                            lastError = e.message ?: "Error reading file"
                                        } finally {
                                            isGenerating = false
                                        }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(backgroundColor = IndigoAccent),
                            modifier = Modifier.fillMaxWidth(),
                            enabled = selectedPhotoUri != null
                        ) {
                            Text("Convert to Depth Map")
                        }
                    }

                    if (lastError != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(lastError!!, color = Color.Red, fontSize = 14.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Preview Card
            Card(
                backgroundColor = CardBackground,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, GrayBorder),
                modifier = Modifier.fillMaxWidth().height(300.dp)
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    when {
                        isGenerating -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(color = GoldAccent)
                                Spacer(modifier = Modifier.height(16.dp))
                                Text("Forging Map in the Cloud...", color = TextPrimary)
                            }
                        }
                        isPolishing -> {
                            // Pipeline step animation overlay
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val steps = listOf(
                                    "Upscaling" to "Converts 8-bit to 16-bit for mathematical precision",
                                    "Inpainting" to "Fills missing data holes to prevent laser artifacts",
                                    "Bilateral Filtering" to "Removes stair-stepping while preserving edges",
                                    "Normalization" to "Stretches depth to full 16-bit range",
                                    "Lossless Export" to "Saves as compressed 16-bit PNG"
                                )
                                steps.forEachIndexed { index, (title, desc) ->
                                    val alpha = when {
                                        index < activePolishStep -> 0.5f
                                        index == activePolishStep -> 1.0f
                                        else -> 0.2f
                                    }
                                    val borderColor = when {
                                        index < activePolishStep -> EmeraldAccent
                                        index == activePolishStep -> IndigoAccent
                                        else -> Color.Transparent
                                    }
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .alpha(alpha)
                                            .border(1.dp, borderColor, RoundedCornerShape(4.dp))
                                            .padding(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(title, color = TextPrimary, fontWeight = FontWeight.Bold)
                                            Text(desc, color = TextSecondary, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                        currentBitmap != null -> {
                            Image(
                                bitmap = currentBitmap!!.asImageBitmap(),
                                contentDescription = "Generated Map",
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        else -> {
                            Text("Awaiting Input Parameters", color = TextSecondary)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action Buttons
            if (currentImageUrl.isNotBlank() && !isGenerating && !isPolishing) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        OutlinedButton(
                            onClick = {
                                currentImageUrl = ""
                                currentBitmap = null
                                isPolished = false
                                bgRemoved = false
                                promptInput = ""
                            },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary)
                        ) {
                            Text("Discard")
                        }

                        if (!bgRemoved) {
                            Button(
                                onClick = {
                                    isRemovingBg = true
                                    coroutineScope.launch {
                                        try {
                                            val res = ApiClient.removeBg(currentImageUrl)
                                            if (res.optString("status") == "success") {
                                                currentImageUrl = res.getString("image_url")
                                                currentBitmap = ApiClient.downloadImage(currentImageUrl)
                                                bgRemoved = true
                                            }
                                        } catch (e: Exception) {
                                            lastError = "Remove BG failed"
                                        } finally {
                                            isRemovingBg = false
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(backgroundColor = PinkAccent)
                            ) {
                                Text(if (isRemovingBg) "Removing..." else "Remove BG")
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    if (!isPolished) {
                        Button(
                            onClick = {
                                isPolishing = true
                                activePolishStep = 0
                                coroutineScope.launch {
                                    val apiJob = async {
                                        try {
                                            val res = ApiClient.postprocess(currentImageUrl)
                                            if (res.optString("status") == "success") {
                                                res.getString("image_url")
                                            } else null
                                        } catch (e: Exception) { null }
                                    }
                                    
                                    // Animate steps
                                    for (i in 0..4) {
                                        activePolishStep = i
                                        delay(2500)
                                    }
                                    
                                    val newUrl = apiJob.await()
                                    if (newUrl != null) {
                                        currentImageUrl = newUrl
                                        currentBitmap = ApiClient.downloadImage(currentImageUrl)
                                        isPolished = true
                                    } else {
                                        lastError = "Polish failed"
                                    }
                                    isPolishing = false
                                    activePolishStep = -1
                                }
                            },
                            colors = ButtonDefaults.buttonColors(backgroundColor = IndigoAccent),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Polish for CNC")
                        }
                    } else {
                        Button(
                            onClick = {
                                currentBitmap?.let { bitmap ->
                                    coroutineScope.launch {
                                        try {
                                            withContext(Dispatchers.IO) {
                                                saveImageToGallery(context, bitmap, "DepthForge_${System.currentTimeMillis()}")
                                            }
                                            scaffoldState.snackbarHostState.showSnackbar("Saved!")
                                        } catch (e: Exception) {
                                            scaffoldState.snackbarHostState.showSnackbar("Failed to save")
                                        }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(backgroundColor = EmeraldAccent),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Download")
                        }
                    }
                }
            }
        }
    }
}

private fun saveImageToGallery(context: Context, bitmap: Bitmap, title: String) {
    val resolver = context.contentResolver
    val contentValues = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, "$title.png")
        put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/DepthForge")
        }
    }
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
    if (uri != null) {
        resolver.openOutputStream(uri).use { stream ->
            if (stream != null) {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            }
        }
    }
}
