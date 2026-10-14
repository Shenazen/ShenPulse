// Domaine Reflection : meme classe plugin, methodes et champs conserves.
using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;

namespace ShenPulse.CultOfTheLamb
{
    public sealed partial class ShenPulseCultReliability
    {
        private static Type FindType(string fullName)
        {
            Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
            for (int index = 0; index < assemblies.Length; index += 1)
            {
                Type type = assemblies[index].GetType(fullName, false);
                if (type != null) return type;
            }
            throw new TypeLoadException(fullName);
        }

        private static object ReadStaticMember(Type type, string name)
        {
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Static
                | BindingFlags.IgnoreCase;
            FieldInfo field = type.GetField(name, flags);
            if (field != null) return field.GetValue(null);
            PropertyInfo property = type.GetProperty(name, flags);
            return property == null
                ? null
                : property.GetValue(null, null);
        }

        private static object ReadMember(object target, string name)
        {
            if (target == null) return null;
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Instance
                | BindingFlags.IgnoreCase;
            Type type = target.GetType();
            FieldInfo field = type.GetField(name, flags);
            if (field != null) return field.GetValue(target);
            PropertyInfo property = type.GetProperty(name, flags);
            return property == null
                ? null
                : property.GetValue(target, null);
        }

        private static void SetMember(
            object target,
            string name,
            object value
        )
        {
            if (target == null) throw new NullReferenceException(name);
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Instance
                | BindingFlags.IgnoreCase;
            Type type = target.GetType();
            FieldInfo field = type.GetField(name, flags);
            if (field != null)
            {
                field.SetValue(target, value);
                return;
            }
            PropertyInfo property = type.GetProperty(name, flags);
            if (property == null || !property.CanWrite)
            {
                throw new MissingMemberException(type.FullName, name);
            }
            property.SetValue(target, value, null);
        }

        private static void SetMemberIfPresent(
            object target,
            string name,
            object value
        )
        {
            try
            {
                SetMember(target, name, value);
            }
            catch
            {
            }
        }

        private static object InvokeStatic(
            Type type,
            string name,
            params object[] arguments
        )
        {
            return InvokeBest(type, null, name, true, arguments);
        }

        private static object InvokeInstance(
            object target,
            string name,
            params object[] arguments
        )
        {
            if (target == null) throw new NullReferenceException(name);
            return InvokeBest(
                target.GetType(),
                target,
                name,
                false,
                arguments
            );
        }

        private static object InvokeBest(
            Type type,
            object target,
            string name,
            bool isStatic,
            object[] arguments
        )
        {
            BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | (isStatic
                    ? BindingFlags.Static
                    : BindingFlags.Instance);
            MethodInfo[] methods = type.GetMethods(flags);
            for (int index = 0; index < methods.Length; index += 1)
            {
                MethodInfo method = methods[index];
                if (method.Name != name
                    || method.GetParameters().Length != arguments.Length)
                {
                    continue;
                }
                ParameterInfo[] parameters = method.GetParameters();
                bool compatible = true;
                for (
                    int parameterIndex = 0;
                    parameterIndex < parameters.Length;
                    parameterIndex += 1
                )
                {
                    object argument = arguments[parameterIndex];
                    Type parameterType =
                        parameters[parameterIndex].ParameterType;
                    if (argument == null)
                    {
                        compatible =
                            !parameterType.IsValueType
                            || Nullable.GetUnderlyingType(parameterType)
                                != null;
                    }
                    else
                    {
                        compatible =
                            parameterType.IsInstanceOfType(argument)
                            || (
                                parameterType.IsEnum
                                && argument.GetType() == parameterType
                            );
                    }
                    if (!compatible) break;
                }
                if (!compatible) continue;
                try
                {
                    return method.Invoke(target, arguments);
                }
                catch (TargetInvocationException error)
                {
                    throw error.InnerException ?? error;
                }
            }
            throw new MissingMethodException(type.FullName, name);
        }
    }
}
