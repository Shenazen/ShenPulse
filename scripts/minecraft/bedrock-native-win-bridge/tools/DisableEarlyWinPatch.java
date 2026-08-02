package fr.shenpulse.minecraft.tools;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import java.util.jar.JarOutputStream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/**
 * Applies the compatibility fixes required by the existing guard JAR.
 * The authoritative native bridge replaces the legacy elapsed-time win
 * detector with s2e-bedrock-box's win-up signal. The in-world WIN/TIME HUD is
 * also disabled without changing the counter, timer, win or interaction-title
 * behavior.
 */
public final class DisableEarlyWinPatch {
  private static final String GUARD_CLASS =
      "fr/shenpulse/minecraft/ShenPulseBedrockGuard.class";
  private static final String EARLY_WIN_METHOD = "checkFullBoxWin";
  private static final Set<String> HIDDEN_HUD_METHODS =
      Set.of("renderWinHud", "renderWinTextDisplayHud", "trackWinTextHudDisplays");

  private DisableEarlyWinPatch() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 3) {
      throw new IllegalArgumentException(
          "Usage: DisableEarlyWinPatch <input.jar> <output.jar> <plugin.yml>");
    }
    patch(Path.of(args[0]), Path.of(args[1]), Path.of(args[2]));
  }

  static void patch(Path input, Path output, Path pluginYml) throws Exception {
    Files.createDirectories(output.toAbsolutePath().getParent());
    Set<String> copiedEntries = new HashSet<>();
    boolean[] guardPatched = {false};

    try (InputStream inputStream = Files.newInputStream(input);
        JarInputStream jarInput = new JarInputStream(inputStream);
        OutputStream outputStream = Files.newOutputStream(output);
        JarOutputStream jarOutput = new JarOutputStream(outputStream)) {
      JarEntry entry;
      while ((entry = jarInput.getNextJarEntry()) != null) {
        String name = entry.getName();
        if ("plugin.yml".equals(name)) {
          continue;
        }
        JarEntry replacement = new JarEntry(name);
        replacement.setTime(0L);
        jarOutput.putNextEntry(replacement);
        if (!entry.isDirectory()) {
          byte[] bytes = readAll(jarInput);
          if (GUARD_CLASS.equals(name)) {
            bytes = patchGuard(bytes);
            guardPatched[0] = true;
          }
          jarOutput.write(bytes);
        }
        jarOutput.closeEntry();
        copiedEntries.add(name);
      }

      JarEntry pluginEntry = new JarEntry("plugin.yml");
      pluginEntry.setTime(0L);
      jarOutput.putNextEntry(pluginEntry);
      Files.copy(pluginYml, jarOutput);
      jarOutput.closeEntry();
    }

    if (!guardPatched[0]) {
      Files.deleteIfExists(output);
      throw new IllegalStateException("ShenPulseBedrockGuard.class was not found.");
    }
  }

  private static byte[] patchGuard(byte[] original) {
    ClassReader reader = new ClassReader(original);
    ClassWriter writer = new ClassWriter(0);
    Set<String> patchedMethods = new HashSet<>();
    ClassVisitor visitor =
        new ClassVisitor(Opcodes.ASM9, writer) {
          @Override
          public MethodVisitor visitMethod(
              int access,
              String name,
              String descriptor,
              String signature,
              String[] exceptions) {
            if (
              "()V".equals(descriptor) &&
              (EARLY_WIN_METHOD.equals(name) || HIDDEN_HUD_METHODS.contains(name))
            ) {
              MethodVisitor replacement =
                  super.visitMethod(access, name, descriptor, signature, exceptions);
              replacement.visitCode();
              replacement.visitInsn(Opcodes.RETURN);
              replacement.visitMaxs(0, (access & Opcodes.ACC_STATIC) == 0 ? 1 : 0);
              replacement.visitEnd();
              patchedMethods.add(name);
              return null;
            }
            return super.visitMethod(access, name, descriptor, signature, exceptions);
          }
        };
    reader.accept(visitor, 0);
    Set<String> requiredMethods = new HashSet<>(HIDDEN_HUD_METHODS);
    requiredMethods.add(EARLY_WIN_METHOD);
    requiredMethods.removeAll(patchedMethods);
    if (!requiredMethods.isEmpty()) {
      throw new IllegalStateException(
          "Guard method(s) not found: " + String.join(", ", requiredMethods));
    }
    return writer.toByteArray();
  }

  private static byte[] readAll(InputStream input) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    input.transferTo(output);
    return output.toByteArray();
  }
}
