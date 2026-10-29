package fr.shenpulse.minecraft.tools;

import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import org.objectweb.asm.*;
import org.objectweb.asm.commons.*;

/** Rebuilds the authorized input under a standalone namespace, without retaining its constant pool. */
public final class PrepareLavaRise {
  public static void main(String[] args) throws Exception {
    String oldMain=args[2],oldRoot=oldMain.substring(0,oldMain.lastIndexOf('.')).replace('.','/');
    String oldSimple=oldMain.substring(oldMain.lastIndexOf('.')+1),brand=oldSimple.replace("LavaRise","");
    String newRoot="fr/shenpulse/lavarise/engine",bridge="fr/shenpulse/lavarise/ShenPulseLavaRise";
    Remapper remapper=new Remapper(Opcodes.ASM9) {
      @Override public String map(String name){return name.replace(oldRoot,newRoot).replace(oldSimple,"LavaRiseEngine");}
      @Override public Object mapValue(Object value){
        if(value instanceof String s)return s.replace(oldRoot,newRoot).replace(oldMain,newRoot.replace('/','.')+".LavaRiseEngine")
          .replace(oldSimple,"LavaRiseEngine").replace("https://"+brand.toLowerCase()+".com","https://shenpulse.leuridan.fr")
          .replace(brand,"ShenPulse").replace(brand.toLowerCase(),"shenpulse");
        return super.mapValue(value);
      }
    };
    int classes=0,particles=0;
    try(JarFile input=new JarFile(args[0]);JarOutputStream output=new JarOutputStream(Files.newOutputStream(Path.of(args[1])))){
      for(JarEntry entry:Collections.list(input.entries())){
        if(!entry.getName().endsWith(".class"))continue;
        byte[] bytes=input.getInputStream(entry).readAllBytes();ClassReader reader=new ClassReader(bytes);ClassWriter writer=new ClassWriter(0);
        final int[] fixes={0};String owner=reader.getClassName();
        final boolean[] victoryTask={false};
        reader.accept(new ClassVisitor(Opcodes.ASM9){
          @Override public MethodVisitor visitMethod(int access,String name,String descriptor,String signature,String[] exceptions){
            if(!name.equals("run"))return null;
            return new MethodVisitor(Opcodes.ASM9){
              @Override public void visitMethodInsn(int opcode,String callOwner,String calledName,String desc,boolean isInterface){
                if(callOwner.equals(oldRoot+"/game/a")&&calledName.equals("R")&&desc.equals("()V"))victoryTask[0]=true;
              }
            };
          }
        },ClassReader.SKIP_DEBUG|ClassReader.SKIP_FRAMES);
        ClassVisitor visitor=new ClassVisitor(Opcodes.ASM9,new ClassRemapper(writer,remapper)) {
          @Override public void visitSource(String source,String debug){super.visitSource(source==null?null:(String)remapper.mapValue(source),null);}
          @Override public MethodVisitor visitMethod(int access,String name,String descriptor,String signature,String[] exceptions){
            MethodVisitor target=super.visitMethod(access,name,descriptor,signature,exceptions);
            return new MethodVisitor(Opcodes.ASM9,target){
              @Override public void visitCode(){super.visitCode();if(owner.equals(oldRoot+"/game/a")&&name.equals("a")&&descriptor.equals("(Z)V")){
                super.visitVarInsn(Opcodes.ALOAD,0);super.visitVarInsn(Opcodes.ILOAD,1);super.visitMethodInsn(Opcodes.INVOKESTATIC,bridge,"beforeStop","(Ljava/lang/Object;Z)V",false);
              }}
              @Override public void visitFieldInsn(int opcode,String fieldOwner,String fieldName,String fieldDescriptor){
                if(opcode==Opcodes.GETSTATIC&&fieldOwner.equals("org/bukkit/Particle")&&Set.of("FLASH","ENTITY_EFFECT").contains(fieldName)){fieldName="CLOUD";fixes[0]++;}
                super.visitFieldInsn(opcode,fieldOwner,fieldName,fieldDescriptor);
              }
              @Override public void visitMethodInsn(int opcode,String calledOwner,String calledName,String calledDescriptor,boolean isInterface){
                // Starting a local minigame does not require making its players server operators.
                if(calledOwner.equals("org/bukkit/entity/Player")&&calledName.equals("setOp")&&calledDescriptor.equals("(Z)V")){
                  super.visitInsn(Opcodes.POP2);return;
                }
                super.visitMethodInsn(opcode,calledOwner,calledName,calledDescriptor,isInterface);
              }
              @Override public void visitInsn(int opcode){
                // The last three numbers used to last two seconds each. Keep the configured duration exact.
                if(victoryTask[0]&&name.equals("run")&&opcode==Opcodes.ICONST_3)opcode=Opcodes.ICONST_0;
                if(opcode==Opcodes.RETURN&&owner.equals(oldRoot+"/game/a")&&name.equals("R")&&descriptor.equals("()V")){
                  super.visitVarInsn(Opcodes.ALOAD,0);super.visitMethodInsn(Opcodes.INVOKESTATIC,bridge,"afterWin","(Ljava/lang/Object;)V",false);
                }
                super.visitInsn(opcode);
              }
              @Override public void visitMaxs(int maxStack,int maxLocals){super.visitMaxs(Math.max(2,maxStack),maxLocals);}
            };
          }
        };
        reader.accept(visitor,0);String name=remapper.map(owner)+".class";output.putNextEntry(new JarEntry(name));output.write(writer.toByteArray());output.closeEntry();classes++;particles+=fixes[0];
      }
    }
    if(classes<5||particles<1)throw new IllegalStateException("Module inattendu : classes ou correctif particules manquants");
    System.out.println(classes+" classes autonomes ; "+particles+" particules corrigées.");
  }
}
