new function()
{
	var debugPrint = function(str)
	{
		//document.write(str + "<br>");
		console.log(str);
	};

	var get16BitsSigned = function(value)
	{
		if(value & 0x8000)
		{
			value = (0x10000 - value) * -1; 
		}
		return value;
	}

	var get8BitsSigned = function(value)
	{
		if(value & 0x80)
		{
			value = (0x100 - value) * -1; 
		}
		return value;
	};

	var getParamLength = function(descriptor)
	{
		var paramLength = 0;
		var i = 0;
		if(descriptor.charAt(i) != "(")
		{
			throw Error("Method descriptor broken");
		}
		i++;
		loop: while(true)
		{
			switch(descriptor.charAt(i))
			{
				case ")":
					break loop;

				case "B":
				case "C":
				case "F":
				case "I":
				case "S":
				case "Z":
					paramLength++;
					i++;
					break;

				case "D":
				case "J":
					paramLength+=2;
					//paramLength++;
					i+=1;
					break;

				case "L":
					paramLength++;
					i++;
					while(descriptor.charAt(i) != ";")
					{
						i++;
					}
					i++;
					break;

				case "[":
					paramLength++;
					i++;
					while(true)
					{
						c = descriptor.charAt(i);
						if(c == "B" || c == "C" || c == "F" || c == "I" || c == "S" || c == "Z" || c == "D" || c == "J")
						{
							i++;
							break;
						}
						else if(c == "L")
						{
							i++;
							while(descriptor.charAt(i) != ";")
							{
								i++;
							}
							i++;
							break;
						}
						else
						{
							//[が続いているはず
							i++;
						}
					}
					break;
			}

		}
		return paramLength
	}

	const CONSTANT_CLASS = 7;
	const CONSTANT_FIELDREF = 9;
	const CONSTANT_METHODREF = 10;
	const CONSTANT_INTERFACEMETHODREF = 11;
	const CONSTANT_STRING = 8;
	const CONSTANT_INTEGER = 3;
	const CONSTANT_FLOAT = 4;
	const CONSTANT_LONG = 5;
	const CONSTANT_DOUBLE = 6;
	const CONSTANT_NAMEANDTYPE = 12;
	const CONSTANT_UTF8 = 1;


	var ConstEmpty = function() {}

	ConstEmpty.prototype.resolve = function(cpool) {
		this.value = "empty";
	}

	ConstEmpty.prototype.debugPrint = function()
	{
		debugPrint("Empty slot");
	}

	var ConstClass = function(tag, nameIndex)
	{
		this.tag = tag;
		this.nameIndex = nameIndex;
	}

	ConstClass.prototype.resolve = function(cpool)
	{
		this.value = cpool[this.nameIndex].value;
	}

	ConstClass.prototype.debugPrint = function()
	{
		debugPrint("Class " + this.value);
	}

	var ConstReferrence = function(tag, classIndex, nameAndTypeIndex)
	{
		this.tag = tag;
		this.classIndex = classIndex;
		this.nameAndTypeIndex = nameAndTypeIndex;
	}

	ConstReferrence.prototype.resolve = function(cpool)
	{
		var className = cpool[cpool[this.classIndex].nameIndex].value;
		var nameAndType = cpool[this.nameAndTypeIndex];
		var name = cpool[nameAndType.nameIndex].value;
		var descriptor = cpool[nameAndType.descriptorIndex].value;
		this.value = {className:className, name:name, descriptor:descriptor};
	}

	ConstReferrence.prototype.debugPrint = function()
	{
		debugPrint("Referrence " + this.value.className + " " + this.value.name + " " + this.value.descriptor);
	}

	var ConstFieldref = function()
	{
		ConstReferrence.apply(this, arguments);
	}

	ConstFieldref.prototype = new ConstReferrence();

	ConstFieldref.prototype.resolve = function()
	{
		ConstReferrence.prototype.resolve.apply(this, arguments);
		var desc = this.value.descriptor.charAt(0);
		switch(desc)
		{
			case "B":
			case "C":
			case "I":
			case "S":
			case "Z":
				this.valueClass = ValueInteger;
				break;
			case "F":
				this.valueClass = ValueFloat;
				break;
			case "D":
				this.valueClass = ValueDouble;
				break;
			case "J":
				this.valueClass = ValueLong;
				break;
			case "L":
			case "[":
				this.valueClass = ValueObject;
				break;
			default:
				this.valueClass = ValueInteger;
		}

	}

	var ConstMethodref = function()
	{
		ConstReferrence.apply(this, arguments);
	}

	ConstMethodref.prototype = new ConstReferrence();

	ConstMethodref.prototype.resolve = function()
	{
		ConstReferrence.prototype.resolve.apply(this, arguments);
		this.paramLength = getParamLength(this.value.descriptor);
	}

	var ConstInterfaceMethodref = function()
	{
		ConstReferrence.apply(this, arguments);
	}

	ConstInterfaceMethodref.prototype = new ConstReferrence();

	var ConstString = function(tag, stringIndex)
	{
		this.tag = tag;
		this.stringIndex = stringIndex;
	}

	ConstString.prototype.resolve = function(cpool)
	{
		//this.value = cpool[this.stringIndex].value;
		this.value = new ValueObject(createJavaString(cpool[this.stringIndex].value));
	}

	ConstString.prototype.debugPrint = function()
	{
		debugPrint("String " + this.value);
	}

	var ConstInteger = function(tag, bytes)
	{
		//debugPrint("ConstInteger:" + bytes);
		this.tag = tag;
		//this.value = get32BitsSigned(bytes);
		//this.value = bytes;
		this.value = new ValueInteger(bytes);
	}

	ConstInteger.prototype.resolve = function(cpool) {}

	ConstInteger.prototype.debugPrint = function()
	{
		debubPrint("Integer " + this.value.value);
	}

	var ConstLong = function(tag, bytes)
	{
		this.tag = tag;
		//this.value = bytes;
		//debugPrint("ConstLong:" + bytes);
		this.value = new ValueLong(bytes);
	}

	ConstLong.prototype.resolve = function(cpool) {}

	ConstLong.prototype.debugPrint = function()
	{
		debugPrint("Long " + this.value.value);
	}

	var ConstFloat = function(tag, bytes)
	{
		this.tag = tag;

		var s = ((bytes >>> 31) == 1) ? -1 : 1;
		var e = (bytes >>> 23) & 0xff;
		var m = (e == 0) ?  (bytes & 0x7fffff) << 1 : (bytes & 0x7fffff) | 0x800000;
		//this.value = s * m * Math.pow(2, e-150);
		this.value = new ValueFloat(s * m * Math.pow(2, e-150));
	}

	ConstFloat.prototype.resolve = function(cpool) {}

	ConstFloat.prototype.debugPrint = function()
	{
		debugPrint("Float " + this.value.value);
	}

	var ConstDouble = function(tag, highBytes, lowBytes)
	{
		this.tag = tag;

		var s = ((highBytes >>> 31) == 1) ? -1 : 1;
		var e = (highBytes >>> 20) & 0x7ff;
		var m;
		if(e == 0)
		{
			m = (highBytes & 0xfffff) * 8589934592.0 + lowBytes * 2.0;
		}
		else
		{
			m = ((highBytes & 0xfffff) | 0x100000) * 4294967296.0 + lowBytes; 
		}
		//debugPrint("s=" + s + " e=" + e + " m=" + m);

		//this.value = s * m * Math.pow(2, e-1075);
		//debugPrint("double value=" + this.value);
		this.value = new ValueDouble(s * m * Math.pow(2, e-1075));
	}

	ConstDouble.prototype.resolve = function(cpool) {}

	ConstDouble.prototype.debugPrint = function()
	{
		debugPrint("Double " + this.value.value);
	}

	var ConstNameAndType = function(tag, nameIndex, descriptorIndex)
	{
		this.tag = tag;
		this.nameIndex = nameIndex;
		this.descriptorIndex = descriptorIndex;
	}

	ConstNameAndType.prototype.resolve = function(cpool)
	{
		var name = cpool[this.nameIndex].value;
		var descriptor = cpool[this.descriptorIndex].value;
		this.value = {name:name, descriptor:descriptor};
	}

	ConstNameAndType.prototype.debugPrint = function()
	{
		debugPrint("NameAndType " + this.value.name + " " + this.value.descriptor);
	}

	var ConstUtf8 = function(tag, length, str)
	{
		this.tag = tag;
		this.length = length;
		this.value = str;
	}

	ConstUtf8.prototype.resolve = function(cpool) {}

	ConstUtf8.prototype.debugPrint = function()
	{
		debugPrint("Utf8 " + this.value);
	}

	var ValueInteger = function(value)
	{
		this.value = value;
	}

	ValueInteger.prototype.duplicate = function()
	{
		return new ValueInteger(this.value);
	}

	ValueInteger.prototype.add = function(x)
	{
		this.value += x.value;
	}

	ValueInteger.prototype.sub = function(x)
	{
		this.value -= x.value;
	}

	ValueInteger.prototype.mul = function(x)
	{
		this.value *= x.value;
	}

	ValueInteger.prototype.div = function(x)
	{
		this.value /= x.value;
	}

	ValueInteger.prototype.rem = function(x)
	{
		this.value %= x.value;
	}

	ValueInteger.prototype.neg = function()
	{
		this.value *= -1;
	}

	ValueInteger.prototype.inc = function(i)
	{
		this.value += i;
	}

	ValueInteger.prototype.shl = function(x)
	{
		this.value <<= x.value;	
	}

	ValueInteger.prototype.shr = function(x)
	{
		this.value >>= x.value;
	}

	ValueInteger.prototype.ushr = function(x)
	{
		this.value >>>= x.value;
	}

	ValueInteger.prototype.and = function(x)
	{
		this.value &= x.value;
	}

	ValueInteger.prototype.or = function(x)
	{
		this.value |= x.value;
	}

	ValueInteger.prototype.xor = function()
	{
		this.value ^= x.value;
	}

	//ここらへんの符号の扱い方がよくわからないorz
	ValueInteger.prototype.toChar = function()
	{
		return new ValueInteger(this.value & 0xFF);
	}

	ValueInteger.prototype.toByte = function()
	{
		return new ValueInteger(this.value & 0xFF);
	}

	ValueInteger.prototype.toShort = function()
	{
		return new ValueInteger(this.value & 0xFFFF);
	}

	ValueInteger.prototype.toDouble = function()
	{
		return new ValueDouble(this.value);
	}

	ValueInteger.prototype.toFloat = function()
	{
		return new ValueFloat(this.value);
	}

	ValueInteger.prototype.toLong = function()
	{
		return new ValueLong(this.value);
	}

	ValueInteger.getClassName = function()
	{
		return "ValueInteger";
	}

	var ValueFloat = function(value)
	{
		this.value = value;
	}

	ValueFloat.prototype.duplicate = function()
	{
		return new ValueFloat(this.value);
	}

	ValueFloat.prototype.add = function(x)
	{
		this.value += x.value;
	}

	ValueFloat.prototype.sub = function(x)
	{
		this.value -= x.value;
	}

	ValueFloat.prototype.mul = function(x)
	{
		this.value *= x.value;
	}

	ValueFloat.prototype.div = function(x)
	{
		this.value /= x.value;
	}

	ValueFloat.prototype.neg = function()
	{
		this.value *= -1.0;
	}

	ValueFloat.prototype.toInteger = function()
	{
		return new ValueInteger(Math.floor(this.value));
	}

	ValueFloat.prototype.toLong = function()
	{
		return new ValueLong(Math.floor(this.value));
	}

	ValueFloat.prototype.toDouble = function()
	{
		return new ValueDouble(this.value);
	}

	ValueFloat.getClassName = function()
	{
		return "ValueFloat";
	}

	var ValueDouble = function(value)
	{
		this.value = value;
	}

	ValueDouble.prototype.duplicate = function()
	{
		return new ValueDouble(this.value);
	}

	ValueDouble.prototype.add = function(x)
	{
		this.value += x.value;
	}

	ValueDouble.prototype.sub = function(x)
	{
		this.value -= x.value;
	}

	ValueDouble.prototype.mul = function(x)
	{
		this.value *= x.value;
	}

	ValueDouble.prototype.div = function(x)
	{
		this.value /= x.value;
	}

	ValueDouble.prototype.neg = function()
	{
		this.value *= -1.0;
	}

	ValueDouble.prototype.toInteger = function()
	{
		return new ValueInteger(Math.floor(this.value));
	}

	ValueDouble.prototype.toFloat = function()
	{
		return new ValueFloat(this.value);
	}

	ValueDouble.prototype.toLong = function()
	{
		return new ValueLong(Math.floor(this.value));
	}

	ValueDouble.getClassName = function()
	{
		return "ValueDouble";
	}

	var ValueLong = function(value)
	{
		this.value = value;
	}

	ValueLong.prototype.add = function(x)
	{
		this.value += x.value;
	}

	ValueLong.prototype.sub = function(x)
	{
		this.value -= x.value;
	}

	ValueLong.prototype.mul = function(x)
	{
		this.value *= x.value;
	}

	ValueLong.prototype.div = function(x)
	{
		this.value /= x.value;
	}

	ValueLong.prototype.rem = function(x)
	{
		this.value %= x.value;
	}

	ValueLong.prototype.neg = function()
	{
		this.value *= -1;
	}

	ValueLong.prototype.and = function(x)
	{
		this.value &= x.value;
	}

	ValueLong.prototype.or = function(x)
	{
		this.value |= x.value;
	}

	ValueLong.prototype.xor = function(x)
	{
		this.value ^= x.value;
	}

	ValueLong.prototype.shl = function(x)
	{
		this.value <<= x.value;
	}

	ValueLong.prototype.shr = function(x)
	{
		this.value >>= x.value;
	}

	ValueLong.prototype.ushr = function(x)
	{
		this.value >>>= this.x;
	}

	ValueLong.prototype.toInteger = function()
	{
		return new ValueInteger(this.value);
	}

	ValueLong.prototype.toDouble = function()
	{
		return new ValueDouble(this.value);
	}

	ValueLong.prototype.toFloat = function()
	{
		return new ValueFloat(this.value);
	}

	ValueLong.prototype.duplicate = function()
	{
		return new ValueLong(this.value);
	}

	ValueLong.getClassName = function()
	{
		return "ValueLong";
	}

	var ValueObject = function(value)
	{
		this.value = value;
	}

	ValueObject.prototype.duplicate = function()
	{
		return new ValueObject(this.value);
	}

	ValueObject.getClassName = function()
	{
		return "ValueObject";
	}

	var ValueDummy = function() {}

	ValueDummy.getClassName = function()
	{
		return "ValueDummy";
	}

	var valueDummy = new ValueDummy();

	var Method = function(accessFlags, name, descriptor, $cappuccino)
	{
		this.accessFlags = accessFlags;
		this.name = name;
		this.descriptor = descriptor;
		this.paramLength = getParamLength(descriptor);
		this.$cappuccino = $cappuccino
	}

	Method.prototype.isStatic = function()
	{
		return(this.accessFlags & 0x0008);
	}

	Method.prototype.debugPrint = function()
	{
		debugPrint("Method " + this.name + " " + this.descriptor + " paramLength=" + this.paramLength);
	}

	Method.prototype.getCompiledMethod = function()
	{
		if(!this.compiledMethod)
		{
			this.compile();
		}
		return this.compiledMethod;
	}

	const NOP = 0x00;
	const ACONST_NULL = 0x01;
	const ICONST_M1 = 0x02;
	const ICONST_0 = 0x03;
	const ICONST_1 = 0x04;
	const ICONST_2 = 0x05;
	const ICONST_3 = 0x06;
	const ICONST_4 = 0x07;
	const ICONST_5 = 0x08;
	const LCONST_0 = 0x09;
	const LCONST_1 = 0x0a;
	const DCONST_0 = 0xe;
	const DCONST_1 = 0xf;
	const BIPUSH = 0x10;
	const SIPUSH = 0x11;
	const LDC = 0x12;
	const LDC2_W = 0x14;
	const ILOAD = 0x15;
	const LLOAD = 0x16;
	const FLOAD = 0x17;
	const DLOAD = 0x18;
	const ALOAD = 0x19;
	const ILOAD_0 = 0x1a;
	const ILOAD_1 = 0x1b;
	const ILOAD_2 = 0x1c;
	const ILOAD_3 = 0x1d;
	const LLOAD_0 = 0x1e;
	const LLOAD_1 = 0x1f;
	const LLOAD_2 = 0x20;
	const LLOAD_3 = 0x21;
	const FLOAD_0 = 0x22;
	const FLOAD_1 = 0x23;
	const FLOAD_2 = 0x24;
	const FLOAD_3 = 0x25;
	const DLOAD_0 = 0x26;
	const DLOAD_1 = 0x27;
	const DLOAD_2 = 0x28;
	const DLOAD_3 = 0x29;
	const ALOAD_0 = 0x2a;
	const ALOAD_1 = 0x2b;
	const ALOAD_2 = 0x2c;
	const ALOAD_3 = 0x2d;
	const IALOAD = 0x2e;
	const LALOAD = 0x2f;
	const FALOAD = 0x30;
	const DALOAD = 0x31;
	const AALOAD = 0x32;
	const ISTORE = 0x36;
	const LSTORE = 0x37;
	const FSTORE = 0x38;
	const DSTORE = 0x39;
	const ASTORE = 0x3a;
	const ISTORE_0 = 0x3b;
	const ISTORE_1 = 0x3c;
	const ISTORE_2 = 0x3d;
	const ISTORE_3 = 0x3e;
	const LSTORE_0 = 0x3f;
	const LSTORE_1 = 0x40;
	const LSTORE_2 = 0x41;
	const LSTORE_3 = 0x42;
	const FSTORE_0 = 0x43;
	const FSTORE_1 = 0x44;
	const FSTORE_2 = 0x45;
	const FSTORE_3 = 0x46;
	const DSTORE_0 = 0x47;
	const DSTORE_1 = 0x48;
	const DSTORE_2 = 0x49;
	const DSTORE_3 = 0x4a;
	const ASTORE_0 = 0x4b;
	const ASTORE_1 = 0x4c;
	const ASTORE_2 = 0x4d;
	const ASTORE_3 = 0x4e;
	const IASTORE = 0x4f;
	const LASTORE = 0x50;
	const FASTORE = 0x51;
	const DASTORE = 0x52;
	const AASTORE = 0x53;
	const POP = 0x57;
	const POP2 = 0x58;
	const DUP = 0x59;
	const DUP2 = 0x5c;
	const SWAP = 0x5f;
	const IADD = 0x60;
	const LADD = 0x61;
	const FADD = 0x62;
	const DADD = 0x63;
	const ISUB = 0x64;
	const LSUB = 0x65;
	const FSUB = 0x66;
	const DSUB = 0x67;
	const IMUL = 0x68;
	const LMUL = 0x69;
	const FMUL = 0x6a;
	const DMUL = 0x6b;
	const IDIV = 0x6c;
	const LDIV = 0x6d;
	const FDIV = 0x6e;
	const DDIV = 0x6f;
	const IREM = 0x70;
	const LREM = 0x71;
	const INEG = 0x74;
	const LNEG = 0x75;
	const FNEG = 0x76;
	const DNEG = 0x77;
	const ISHL = 0x78;
	const LSHL = 0x79;
	const ISHR = 0x7a;
	const LSHR = 0x7b;
	const IUSHR = 0x7c;
	const LUSHR = 0x7d;
	const IAND = 0x7e;
	const LAND = 0x7f;
	const IOR = 0x80;
	const LOR = 0x81;
	const IXOR = 0x82;
	const LXOR = 0x83;
	const IINC = 0x84;
	const I2L = 0x85;
	const I2F = 0x86;
	const I2D = 0x87;
	const L2I = 0x88;
	const L2F = 0x89;
	const L2D = 0x8a;
	const F2I = 0x8b;
	const F2L = 0x8b;
	const F2D = 0x8d;
	const D2I = 0x8e;
	const D2L = 0x8f;
	const D2F = 0x90;
	const I2B = 0x91;
	const I2C = 0x92;
	const I2S = 0x93;
	const LCMP = 0x94;
	const DCMPL = 0x97;
	const DCMPG = 0x98;
	const IFEQ = 0x99;
	const IFNE = 0x9a;
	const IFLT = 0x9b;
	const IFGE = 0x9c;
	const IFGT = 0x9d;
	const IFLE = 0x9e;
	const IF_ICMPEQ = 0x9f;
	const IF_ICMPNE = 0xa0;
	const IF_ICMPLT = 0xa1;
	const IF_ICMPGE = 0xa2;
	const IF_ICMPGT = 0xa3;
	const IF_ICMPLE = 0xa4;
	const IF_ACMPEQ = 0xa5;
	const IF_ACMPNE = 0xa6;
	const GOTO = 0xa7;
	const TABLESWITCH = 0xaa;
	const LOOKUPSWITCH = 0xab;
	const IRETURN = 0xac;
	const LRETURN = 0xad;
	const FRETURN = 0xae;
	const DRETURN = 0xaf;
	const ARETURN = 0xb0;
	const RETURN = 0xb1;
	const GETSTATIC = 0xb2;
	const PUTSTATIC = 0xb3;
	const GETFIELD = 0xb4;
	const PUTFIELD = 0xb5;
	const INVOKEVIRTUAL = 0xb6;
	const INVOKESPECIAL = 0xb7;
	const INVOKESTATIC = 0xb8;
	const INVOKEINTERFACE = 0xb9;
	const NEW = 0xbb;
	const NEWARRAY = 0xbc;
	const ANEWARRAY = 0xbd;
	const ARRAYLENGTH = 0xbe;
	const MULTIANEWARRAY = 0xc5;
	const IFNULL = 0xc6;
	const IFNONNULL = 0xc7;
	
	Method.instTable = [];
	var notImplement = function(code, i, jsCodes, $cappuccino)
	{
		throw Error("Not implemented pc=" + i + " opcode=" + code[i]);
	}
	var i;
	for(i=0; i < 256; i++)
	    Method.instTable[i] = notImplement;
	
	Method.instTable[NOP] = function(code, i, jsCodes)
	{
		return i + 1;
	}

	Method.instTable[ISTORE] = Method.instTable[ASTORE] = Method.instTable[FSTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackTop+" + code[i+1] + "] = vmStack.pop();");
		return i + 2;
	}

	Method.instTable[DSTORE] = Method.instTable[LSTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack[stackTop+" + code[i+1] + "] = vmStack.pop()");
		return i + 2;
	}

	Method.instTable[ISTORE_0] =  Method.instTable[ASTORE_0] = Method.instTable[FSTORE_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackTop] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DSTORE_0] = Method.instTable[LSTORE_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack[stackTop] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[ISTORE_1] = Method.instTable[ASTORE_1] = Method.instTable[FSTORE_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackTop + 1] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DSTORE_1] = Method.instTable[LSTORE_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack[stackTop + 1] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[ISTORE_2] = Method.instTable[ASTORE_2] = Method.instTable[FSTORE_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackTop + 2] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DSTORE_2] = Method.instTable[LSTORE_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack[stackTop + 2] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[ISTORE_3] = Method.instTable[ASTORE_3] = Method.instTable[FSTORE_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackTop + 3] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DSTORE_3] = Method.instTable[LSTORE_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack[stackTop + 3] = vmStack.pop();");
		return i + 1;
	}

	Method.instTable[ILOAD] = Method.instTable[ALOAD] = Method.instTable[FLOAD]  = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+" + code[i+1] +"].duplicate());");
		return i + 2;
	}

	Method.instTable[DLOAD] = Method.instTable[LLOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+" + code[i+1] +"].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 2;
	}

	Method.instTable[ILOAD_0] = Method.instTable[ALOAD_0] = Method.instTable[FLOAD_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop].duplicate());");
		return i + 1;
	}

	Method.instTable[DLOAD_0] = Method.instTable[LLOAD_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[ILOAD_1] = Method.instTable[ALOAD_1] = Method.instTable[FLOAD_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+1].duplicate());");
		return i + 1;
	}

	Method.instTable[DLOAD_1] = Method.instTable[LLOAD_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+1].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[ILOAD_2] = Method.instTable[ALOAD_2] = Method.instTable[FLOAD_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+2].duplicate());");
		return i + 1;
	}

	Method.instTable[DLOAD_2] = Method.instTable[LLOAD_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+2].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[ILOAD_3] = Method.instTable[ALOAD_3] = Method.instTable[FLOAD_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+3].duplicate());");
		return i + 1;
	}

	Method.instTable[DLOAD_3] = Method.instTable[LLOAD_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[stackTop+3].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[IASTORE] = Method.instTable[AASTORE] = Method.instTable[FASTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("operand2 = vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("obj[operand1] = operand2;");
		return i + 1;
	}

	Method.instTable[DASTORE] = Method.instTable[LASTORE] =  function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand2 = vmStack.pop()");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("obj[operand1] = operand2;");
		return i + 1;
	}

	Method.instTable[IALOAD] = Method.instTable[AALOAD] = Method.instTable[FALOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("vmStack.push(obj[operand1].duplicate());");
		return i + 1;
	}

	Method.instTable[DALOAD] = Method.instTable[LALOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("vmStack.push(obj[operand1].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[POP] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[POP2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[DUP] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack[vmStack.length-1].duplicate());");
		return i + 1;
	}

	Method.instTable[DUP2] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[vmStack.length-2].constructor.getClassName();");
		//jsCodes.push("CappuccinoVM.debugPrint('dup2:' +  operand1);");
		jsCodes.push("if((operand1 == 'ValueInteger') || (operand1 == 'ValueFloat') || (operand1 == 'ValueObject')){");
		jsCodes.push("vmStack.push(vmStack[vmStack.length-2].duplicate());");
		jsCodes.push("vmStack.push(vmStack[vmStack.length-2].duplicate());");
		jsCodes.push("}else{"); //Long, Double
		jsCodes.push("vmStack.push(vmStack[vmStack.length-2].duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);}");
		return i + 1;
	}

	Method.instTable[SWAP] = function(code, i, jsCodes)
	{
		jsCodes.push("operand2 = vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop();");
		jsCodes.push("vmStack.push(operand2);");
		jsCodes.push("vmStack.push(operand1);");
		return i + 1;
	}

	Method.instTable[BIPUSH] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(" + get8BitsSigned(code[i+1]) + "));");
		return i + 2;
	}

	Method.instTable[SIPUSH] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(" + get16BitsSigned((code[i+1] << 8) + code[i+2]) + "));");
		return i + 3;
	}

	Method.instTable[ACONST_NULL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueObject(null));");
		return i + 1;
	}

	Method.instTable[ICONST_M1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(-1));");
		return i + 1;
	}

	Method.instTable[ICONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(0));");
		return i + 1;
	}

	Method.instTable[ICONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(1));");
		return i + 1;
	}

	Method.instTable[ICONST_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(2));");
		return i + 1;
	}

	Method.instTable[ICONST_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(3));");
		return i + 1;
	}

	Method.instTable[ICONST_4] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(4));");
		return i + 1;
	}

	Method.instTable[LCONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueLong(0));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[LCONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueLong(1));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[ICONST_5] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(5));");
		return i + 1;
	}

	Method.instTable[DCONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueDouble(0.0));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[DCONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueDouble(1.0));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[IFEQ] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1==0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1!=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFLT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1<0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFLE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1<=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFGT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1>0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFGE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1>=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPEQ] = Method.instTable[IF_ACMPEQ] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1==operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPNE] = Method.instTable[IF_ACMPNE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1!=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPLT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1<operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPLE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1<=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPGT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1>operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPGE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1>=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNULL] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1 == null){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNONNULL] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1 != null){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[GOTO] = function(code, i, jsCodes)
	{
		var addr;
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;");
		return i + 3;
	}

	Method.instTable[TABLESWITCH] = function(code, i, jsCodes)
	{
		var _i, j, addr, defaddr, low, high;
		_i = i + (0x04 - (i & 0x03));
		defaddr = i + ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
		_i += 4;
		low = ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
		_i += 4;
		high = ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
		_i += 4;
		jsCodes.push("operand1 = vmStack.pop().value;");
		for(j = low; j <= high; j++)
		{
			addr = i + ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
			jsCodes.push("if(operand1 == " + j + "){pc =" + addr + "; continue;}"); 
			_i += 4;
		}
		jsCodes.push("pc=" + defaddr + "; continue;");
		return _i;
	}

	Method.instTable[LOOKUPSWITCH] = function(code, i, jsCodes)
	{
		var _i, j, addr, defaddr, npairs, match; 
		_i = i + (0x04 - (i & 0x03));
		defaddr = i + ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
		_i += 4;
		npairs = (code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3];
		_i += 4;
		jsCodes.push("operand1 = vmStack.pop().value;");
		for(j = 0; j < npairs; j++)
		{
			match = ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
			_i += 4;
			addr = i + ((code[_i] << 24) + (code[_i+1] << 16) + (code[_i+2] << 8) + code[_i+3]);
			jsCodes.push("if(operand1==" + match + "){pc=" + addr + "; continue;}");
			_i += 4;
		}
		jsCodes.push("pc=" + defaddr + "; continue;");
		return _i;
	}

	Method.instTable[IINC] = function(code, i, jsCodes)
	{
		//jsCodes.push("vmStack[stackTop+" + code[i+1] + "].value+=" + get8BitsSigned(code[i+2]) + ";");
		jsCodes.push("vmStack[stackTop+" + code[i+1] + "].inc(" + get8BitsSigned(code[i+2]) + ");");
		return i + 3;
	}

	Method.instTable[IADD] = Method.instTable[FADD] = function(code, i, jsCodes)
	{
		//jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(vmStack.pop().value + vmStack.pop().value));");
		jsCodes.push("vmStack[vmStack.length-2].add(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DADD] = Method.instTable[LADD] = function(code, i, jsCodes)
	{
		/*
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueDouble(operand1 + operand2));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		*/
		jsCodes.push("vmStack[vmStack.length-4].add(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[ISUB] = Method.instTable[FSUB] = function(code, i, jsCodes)
	{
		//jsCodes.push("operand2 = vmStack.pop().value;");
		//jsCodes.push("operand1 = vmStack.pop().value;");
		//jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(operand1 - operand2));");
		jsCodes.push("vmStack[vmStack.length-2].sub(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DSUB] = Method.instTable[LSUB] = function(code, i, jsCodes)
	{
		/*
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueDouble(operand1 - operand2));");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		*/
		jsCodes.push("vmStack[vmStack.length-4].sub(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IMUL] = Method.instTable[FMUL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].mul(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DMUL] = Method.instTable[LMUL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].mul(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IDIV] = Method.instTable[FDIV] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].div(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[DDIV] = Method.instTable[LDIV] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].div(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IREM] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].rem(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LREM] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].rem(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[INEG] = Method.instTable[FNEG] =  function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-1].neg();");
		return i + 1;
	}

	Method.instTable[DNEG] = Method.instTable[LNEG] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].neg();");
		return i + 1;
	}

	Method.instTable[LCMP] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1 > operand2){vmStack.push(new CappuccinoVM.ValueInteger(1));}");
		jsCodes.push("else if(operand1 == operand2){vmStack.push(new CappuccinoVM.ValueInteger(0));}");
		jsCodes.push("else {vmStack.push(new CappuccinoVM.ValueInteger(-1));}");
		return i + 1;
	}

	Method.instTable[DCMPL] = Method.instTable[DCMPG] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand2 = vmStack.pop().value;");
		jsCodes.push("vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop().value;");
		jsCodes.push("if(operand1 > operand2){vmStack.push(new CappuccinoVM.ValueInteger(1));}");
		jsCodes.push("else if(operand1 == operand2){vmStack.push(new CappuccinoVM.ValueInteger(0));}");
		jsCodes.push("else {vmStack.push(new CappuccinoVM.ValueInteger(-1));}");
		return i + 1;
	}

	Method.instTable[ISHL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].shl(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LSHL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].shl(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[ISHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].shr(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].shr(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IUSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].ushr(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LUSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].ushr(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IAND] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].and(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LAND] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].and(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].or(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].or(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[IXOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-2].xor(vmStack[vmStack.length-1]);");
		jsCodes.push("vmStack.pop();");
		return i + 1;
	}

	Method.instTable[LXOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[vmStack.length-4].xor(vmStack[vmStack.length-2]);");
		jsCodes.push("vmStack.pop(); vmStack.pop()");
		return i + 1;
	}

	Method.instTable[I2C] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toChar());");
		return i + 1;
	}

	Method.instTable[I2B] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toByte());");
		return i + 1;
	}

	Method.instTable[I2S] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toShort());");
		return i + 1;
	}

	Method.instTable[I2F] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toFloat());");
		return i + 1;
	}

	Method.instTable[I2D] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toDouble());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[I2L] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toLong());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}


	Method.instTable[F2I] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toInteger());");
		return i + 1;
	}

	Method.instTable[F2D] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toDouble());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[F2L] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.push(vmStack.pop().toLong());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[L2I] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toInteger());");
		return i + 1;
	}

	Method.instTable[L2F] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toFloat());");
		return i + 1;
	}

	Method.instTable[L2D] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toDouble());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}


	Method.instTable[D2I] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toInteger());");
		return i + 1;
	}

	Method.instTable[D2F] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toFloat());");
		return i + 1;
	}

	Method.instTable[D2L] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("vmStack.push(vmStack.pop().toLong());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 1;
	}

	Method.instTable[NEW] = function(code, i, jsCodes, $cappuccino)
	{
		var cindex = (code[i+1] << 8) + code[i+2];
		var cname = $cappuccino.constantPool[cindex].value;
		jsCodes.push("jclass = CappuccinoVM.getJavaClass('" + cname  + "');");
		jsCodes.push("if(jclass == null){return {action:'loadClass', className:'" + cname + "', pc:" + i + "}}");
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueObject(new jclass()));");
		return i + 3;
	}

	Method.instTable[NEWARRAY] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();"); //countは捨てる
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueObject([]));");
		return i + 2;
	}

	Method.instTable[ANEWARRAY] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();"); //countは捨てる
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueObject([]));");
		return i + 3;
	}

	Method.instTable[ARRAYLENGTH] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack.pop();");
		jsCodes.push("vmStack.push(new CappuccinoVM.ValueInteger(operand1.value.length));");
		return i + 1;
	}

	var makeArray = function(vmStack, dim)
	{
		var array = [];
		if(dim >= 2)
		{
			var count = vmStack[vmStack.length - dim].value;
			for(var i = 0; i < count; i++)
			{
				array.push(makeArray(vmStack, dim-1));
			}
		}
		return new ValueObject(array);
	}

	Method.instTable[MULTIANEWARRAY] = function(code, i, jsCodes)
	{
		var j;
		var dim = code[i+3];
		jsCodes.push("obj = CappuccinoVM.makeArray(vmStack, " + dim + ");");
		for(j=0; j < dim; j++)
			jsCodes.push("vmStack.pop();");
		//jsCodes.push("CappuccinoVM.debugPrint('array=' + obj.value);");
		jsCodes.push("vmStack.push(obj);");
		return i + 4;
	}

	Method.instTable[LDC] = function(code, i, jsCodes, $cappuccino)
	{
		var cindex = code[i+1];
		jsCodes.push("vmStack.push($cappuccino.constantPool[" + cindex + "].value.duplicate());");
		return i + 2;
	}

	Method.instTable[LDC2_W] = function(code, i, jsCodes, $cappuccino)
	{
		//var constant = $cappuccino.constantPool[get16BitsSigned((code[i+1] << 8) + code[i+2])];
		//jsCodes.push("vmStack.push(" + constant.value + ");");
		var cindex = get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("vmStack.push($cappuccino.constantPool[" + cindex + "].value.duplicate());");
		jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);")
		return i + 3;
	}

	Method.instTable[GETSTATIC] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var valueClassName = $cappuccino.constantPool[index].valueClass.getClassName();
		jsCodes.push("refjclass = CappuccinoVM.getJavaClass($cappuccino.constantPool[" + index + "].value.className);");
		jsCodes.push("if(refjclass == null){return {action:'loadClass', className: $cappuccino.constantPool[" + index + "], pc:" + i + "}}");
		jsCodes.push("name = $cappuccino.constantPool[" + index + "].value.name;");
		jsCodes.push("jclass = $cappuccino.findFieldOwner(name, refjclass);");
		jsCodes.push("vmStack.push(jclass[name].duplicate());");
		if(valueClassName == "ValueDouble" || valueClassName == "ValueLong")
			jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 3;
	}

	Method.instTable[PUTSTATIC] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var valueClassName = $cappuccino.constantPool[index].valueClass.getClassName();
		jsCodes.push("refjclass = CappuccinoVM.getJavaClass($cappuccino.constantPool[" + index + "].value.className);");
		jsCodes.push("if(refjclass == null){return {action:'loadClass', className: $cappuccino.constantPool[" + index + "], pc:" + i + "}}");
		jsCodes.push("name = $cappuccino.constantPool[" + index + "].value.name;");
		jsCodes.push("jclass = $cappuccino.findFieldOwner(name, refjclass);");
		if(valueClassName == "ValueDouble" || valueClassName == "ValueLong")
			jsCodes.push("vmStack.pop();");
		jsCodes.push("jclass[name]=vmStack.pop()");
		return i + 3;
	}

	Method.instTable[GETFIELD] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fname = $cappuccino.constantPool[index].value.name;
		var valueClassName = $cappuccino.constantPool[index].valueClass.getClassName();
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("vmStack.push(obj['" + fname + "'].duplicate());");
		if(valueClassName == "ValueDouble" || valueClassName == "ValueLong")
			jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		return i + 3;
	}

	Method.instTable[PUTFIELD] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fname = $cappuccino.constantPool[index].value.name;
		var valueClassName = $cappuccino.constantPool[index].valueClass.getClassName();
		if(valueClassName == "ValueDouble" || valueClassName == "ValueLong")
			jsCodes.push("vmStack.pop();");
		jsCodes.push("operand1 = vmStack.pop();");
		jsCodes.push("obj = vmStack.pop().value;");
		jsCodes.push("obj['" + fname + "'] = operand1;");
		return i + 3;
	}

	Method.instTable[INVOKESTATIC] = function(code, i, jsCodes)
	{
		var index;
		index = (code[i+1] << 8) + code[i+2];
		jsCodes.push("methodref = $cappuccino.constantPool[" + index + "];");
		jsCodes.push("jclass = CappuccinoVM.getJavaClass(methodref.value.className);");
		jsCodes.push("if(jclass == null){return {action:'loadClass', className: methodref.value.className, pc:" + i + "}}");
		jsCodes.push("method = jclass.$cappuccino.findMethod(methodref.value.name, methodref.value.descriptor);"); 
		jsCodes.push("return {action:'invoke', method:method, pc:" + (i+3) + "};");
		return i + 3;
	}

	Method.instTable[INVOKEVIRTUAL] = function(code, i, jsCodes)
	{
		var index;
		index = (code[i+1] << 8) + code[i+2];
		jsCodes.push("methodref = $cappuccino.constantPool[" + index + "];");
		jsCodes.push("sp = vmStack.length - methodref.paramLength - 1;");
		jsCodes.push("method = vmStack[sp].value.constructor.$cappuccino.findMethod(methodref.value.name, methodref.value.descriptor);");
		jsCodes.push("return {action:'invoke', method:method, pc:" + (i+3) + "};");
		return i + 3;
	}

	Method.instTable[INVOKESPECIAL] = function(code, i, jsCodes)
	{
		var index;
		index = (code[i+1] << 8) + code[i+2];
		jsCodes.push("methodref = $cappuccino.constantPool[" + index + "];");
		jsCodes.push("jclass = CappuccinoVM.getJavaClass(methodref.value.className);");
		jsCodes.push("if(jclass == null){return {action:'loadClass', className: methodref.value.className, pc:" + i + "}}");
		jsCodes.push("method = jclass.$cappuccino.findMethod(methodref.value.name, methodref.value.descriptor);"); 
		jsCodes.push("return {action:'invoke', method:method, pc:" + (i+3) + "};");
		return i + 3;
	}

	Method.instTable[RETURN] = function(code, i, jsCodes)
	{
		jsCodes.push("return {action:'return'};");
		return i + 1;
	}

	Method.instTable[IRETURN] = Method.instTable[FRETURN] = Method.instTable[ARETURN] =   function(code, i, jsCodes)
	{
		jsCodes.push("return {action:'returnValue', value:vmStack.pop()};");
		return i + 1;
	}

	Method.instTable[DRETURN] = Method.instTable[LRETURN] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack.pop();");
		jsCodes.push("return {action:'returnValueWide', value:vmStack.pop()};");
		return i + 1;
	}

	Method.prototype.compile = function()
	{
		var jsCodes = [];
		var i = 0;
		var code = this.codeAttr.code;

		/*
		jsCodes.push("var vmStack = arguments[0];");
		jsCodes.push("var stackTop = arguments[1];");
		jsCodes.push("var pc = arguments[2];");
		jsCodes.push("var $cappuccino = arguments[3];");
		*/

		jsCodes.push("var vmStack = arguments[0].vmStack;");
		jsCodes.push("var stackTop = arguments[0].stackTop;");
		jsCodes.push("var pc = arguments[0].pc;");
		jsCodes.push("var $cappuccino = arguments[0].currentMethod.$cappuccino;");

		//jsCodes.push("CappuccinoVM.debugPrint(vmStack);");
		//jsCodes.push("CappuccinoVM.debugPrint(stackTop);");
		//jsCodes.push("CappuccinoVM.debugPrint(pc);");
		//jsCodes.push("CappuccinoVM.debugPrint($cappuccino);");
		jsCodes.push("var methodref, jclass, refjclass, method, name, sp, operand1, operand2, obj;");
		jsCodes.push("while(true){");
		jsCodes.push("switch(pc){");
		while(i < code.length)
		{
			jsCodes.push("case " + i + ":");
			//jsCodes.push("CappuccinoVM.debugPrint('pc=" + i + "');");
			i = Method.instTable[code[i]](code, i, jsCodes, this.$cappuccino);
		}
		jsCodes.push("default: throw Error('Invalid pc?');");
		jsCodes.push("}}");

		//debugPrint("//" + this.name);
		//for(i = 0; i < jsCodes.length; i++)
		//{
		//	debugPrint(jsCodes[i]);
		//}

		this.compiledMethod = new Function(jsCodes.join("\n"));
	}

	var Code = function(maxStack, maxLocals, code)
	{
		this.maxStack = maxStack;
		this.maxLocals = maxLocals;
		this.code = code;
	}

	var CVMInfo = function(thisClass)
	{
		this.methods = {}
		this.thisClass = thisClass;
	}

	CVMInfo.prototype.addMethod = function(method)
	{
		if(this.methods[method.name] == null)
		{
			this.methods[method.name] = {};
		}
		this.methods[method.name][method.descriptor] = method;
	}

	CVMInfo.prototype.findMethod = function(name, descriptor)
	{
		if(this.methods[name] && this.methods[name][descriptor])
		{
			return this.methods[name][descriptor];
		}
		else
		{
			if(this.superClass)
			{
				return this.superClass.$cappuccino.findMethod(name, descriptor);
			}
			else
			{
				//superClassがnullということはこれはObjectクラス?
				//あり得ない
				throw Error("can't find method: " + name + " " + descriptor);
			}
		}
	}

	CVMInfo.prototype.findFieldOwner = function(name, jclass)
	{
		if(jclass[name] != undefined)
		{
			return jclass;
		}
		else if(jclass.$cappuccino.superClass)
		{
			return this.findFieldOwner(name, jclass.$cappuccino.superClass);
		}
		else
		{
			throw Error("static field " + name + " not found");
		}
	}

	CVMInfo.prototype.initClass = function()
	{
		if(this.methods["<clinit>"] && this.methods["<clinit>"]["()V"])
		{
			//スレッドをつくってclinitを実行する
			new JavaThread(this.methods["<clinit>"]["()V"], []).runNoReturn();
		}
	}

	var getUnicodeString = function(classData, start, length)
	{
		var i = 0;
		var str = "";
		var byte1, byte2, byte3;
		do
		{
			byte1 = classData[start+i];
			//str = str + String.fromCharCode(byte1);
			//i++;
			if((byte1 & 0x80) == 0)
			{
				str = str + String.fromCharCode(byte1);
				i++;
			}
			else if((byte1 & 0xe0) == 0xc0)
			{
				byte2 = classData[start+i+1];
				str = str + String.fromCharCode(((byte1 & 0x1f) << 6) + (byte2 & 0x3f));
				i+=2;
			}
			else if((byte1 & 0xf0) == 0xe0)
			{
				byte2 = classData[start+i+1];
				byte3 = classData[start+i+2];
				str = str + String.fromCharCode(((byte1 & 0x0f) << 12) + ((byte2 & 0x3f) << 6) + (byte3 & 0x3f));
				i+=3;
			}
			else
			{
				//サロゲートペア非対応
				i++;
			}
		}while(i < length);
		return str;
	}

	var getClassfileURL = function(className)
	{
		//完全修飾名からURLを取得する
		//とりあえず.classをつけるだけ
		return className + ".class";
	}

	var loadJavaClass = function(classData)
	{
		var javaClass = function() {};

		//VMのための様々な情報はここに詰め込む
		//読み込むJavaのクラスに$cappuccinoという名前のメソッドやフィールドが存在する場合の対策が必要
		//(prototypeとかにも同じことがいえる)
		javaClass.$cappuccino = new CVMInfo(javaClass);

		if(!(classData[0] == 0xca && classData[1] == 0xfe && classData[2] == 0xba && classData[3] == 0xbe))
		{
			throw Error("this is not Java Classfile!");
		}
		
		var i = 8;
		var cpCount = classData[i+1] + (classData[i] << 8);
		i += 2;

		var cpool = [new ConstEmpty()];
		var c;
		var j;
		var highBytes, lowBytes;
		for(j = 0; j < cpCount - 1; j++)
		{
			switch(classData[i])
			{
				case CONSTANT_CLASS:
					c = new ConstClass(classData[i], (classData[i+1] << 8) + classData[i+2]);
					cpool.push(c);
					i += 3;
					break;

				case CONSTANT_FIELDREF:
					c = new ConstFieldref(classData[i], (classData[i+1] << 8) + classData[i+2], (classData[i+3] << 8) + classData[i+4]);
					cpool.push(c);
					i += 5;
					break;

				case CONSTANT_METHODREF:
					c = new ConstMethodref(classData[i], (classData[i+1] << 8) + classData[i+2], (classData[i+3] << 8) + classData[i+4]);
					cpool.push(c);
					i += 5;
					break;

				case CONSTANT_INTERFACEMETHODREF:
					c = new ConstInterfaceMethodref(classData[i], (classData[i+1] << 8) + classData[i+2], (classData[i+3] << 8) + classData[i+4]);
					cpool.push(c);
					i += 5;
					break;

				case CONSTANT_STRING:
					c = new ConstString(classData[i], (classData[i+1] << 8) + classData[i+2])
					cpool.push(c);
					i += 3;
					break;

				case CONSTANT_INTEGER:
					c = new ConstInteger(classData[i], (classData[i+1] << 24) + (classData[i+2] << 16) + (classData[i+3] << 8) + classData[i+4])
					cpool.push(c);
					i += 5;
					break;

				case CONSTANT_FLOAT:
					c = new ConstFloat(classData[i], (classData[i+1] << 24) + (classData[i+2] << 16) + (classData[i+3] << 8) + classData[i+4])
					cpool.push(c);
					i +=5;
					break;

				case CONSTANT_LONG:
					//仮の実装
					c  = new ConstLong(classData[i], (classData[i+1] << 56) + (classData[i+2] << 48) + (classData[i+3] << 40) + (classData[i+4] << 32) + (classData[i+5] << 24) + (classData[i+6] << 16) + (classData[i+7] << 8) + classData[i+8]);
					cpool.push(c);
					//cpool.push(new ConstEmpty());
					cpool.push(new ConstEmpty());
					j++;
					i += 9;
					break;
				
				case CONSTANT_DOUBLE:
					highBytes = (classData[i+1] << 24) + (classData[i+2] << 16) + (classData[i+3] << 8) + classData[i+4];
					lowBytes = (classData[i+5] << 24) + (classData[i+6] << 16) + (classData[i+7] << 8) + classData[i+8];
					c = new ConstDouble(classData[i], highBytes >>> 0, lowBytes >>> 0);
					cpool.push(c);
					cpool.push(new ConstEmpty());
					j++;
					i += 9;
					break;

				case CONSTANT_NAMEANDTYPE:
					c = new ConstNameAndType(classData[i], (classData[i+1] << 8) + classData[i+2], (classData[i+3] << 8) + classData[i+4]);
					cpool.push(c);
					i += 5;
					break;

				case CONSTANT_UTF8:
					var tag = classData[i];
					var length = (classData[i+1] << 8) + classData[i+2];
					/*
					var str = "";
					for(var k=0; k < length; k++)
						str = str + String.fromCharCode(classData[i+3+k]);
					c = new ConstUtf8(tag, length, str);
					*/
					c = new ConstUtf8(tag, length, getUnicodeString(classData, i+3, length));
					cpool.push(c);
					i += 3 + length;
					break;

				default:
					throw Error("read constant pool error offset=" + i);

			}

		}

		for(j = 0; j < cpCount; j ++)
		{
			cpool[j].resolve(cpool); //resolveしたあとはvalueが参照できる
			//cpool[j].debugPrint();
		}

		//constant poolはコード生成のときに使う
		javaClass.$cappuccino.constantPool = cpool;

		javaClass.$cappuccino.accessFlags = (classData[i] << 8) + classData[i+1];
		i += 2;
		//debugPrint("accessFlags=" + javaClass.$cappuccino.accessFlags);

		var thisClassIndex = (classData[i] << 8) + classData[i+1];
		i += 2;
		javaClass.$cappuccino.thisClassName = cpool[thisClassIndex].value;
		//debugPrint("thisClassName=" + javaClass.$cappuccino.thisClassName);

		var superClassIndex = (classData[i] << 8) + classData[i+1];
		i += 2;
		javaClass.$cappuccino.superClassName = cpool[superClassIndex].value;
		//debugPrint("suerClassName=" + javaClass.$cappuccino.superClassName);

		//javaClass.$cappuccino.superClass = getJavaClass(javaClass.$cappuccino.superClassName)

		//Interfaceなんてどうでもいい気がするけど一応…
		var interfacesCount = (classData[i] << 8) + classData[i + 1];
		i += 2;
		var interfaces = [];
		for (j = 0; j < interfacesCount * 2; j++)
		{
			interfaces.push((classData[i+j] << 8) + classData[i+j+1]);
		}
		i += interfacesCount * 2; 

		javaClass.$cappuccino.interfaces = interfaces;

		var fieldsCount = (classData[i] << 8) + classData[i+1];
		i += 2;
		var accessFlags;
		var nameIndex;
		var fieldName;
		var attributesCount;
		var attributeNameIndex;
		var attributeLength;
		var constatnValueIndex;
		var k;
		for(j = 0; j < fieldsCount; j ++)
		{
			accessFlags = (classData[i] << 8) + classData[i+1];
			i += 2;
			nameIndex = (classData[i] << 8) + classData[i+1];
			i += 4; //descriptor_indexは読みとばす
			attributesCount = (classData[i] << 8) + classData[i+1];
			i += 2;
			fieldName = cpool[nameIndex].value;
			//とりあえず0で初期化しておく
			if(accessFlags & 0x0008)
			{
				javaClass[fieldName] = 0;
			}
			for(k = 0; k < attributesCount; k++)
			{
				attributeNameIndex = (classData[i] << 8) + classData[i+1];
				i += 2;
				attributeLength = (classData[i] << 24) + (classData[i+1] << 16) + (classData[i+2] << 8) + classData[i+3];
				i += 4;
				if(accessFlags & 0x0008 && cpool[attributeNameIndex].value == "ConstantValue")
				{
					constantValueIndex = (classData[i] << 8) + classData[i+1];
					javaClass[fieldName] = cpool[constantValueIndex].value;
				}
				i += attributeLength;
			}
		}

		var methodsCount = (classData[i] << 8) + classData[i+1];
		i += 2;

		var method;
		var descriptorIndex;
		var maxStack;
		var maxLocals;
		var codeLength;
		var code;
		var l;
		var codeAttr;
		var exceptionTablesCount;
		var exceptionTables;
		var startPC;
		var endPC;
		var handlerPC;
		var catchType;
		for(j = 0; j < methodsCount; j++)
		{
			accessFlags = (classData[i] << 8) + classData[i+1];
			i += 2;
			nameIndex = (classData[i] << 8) + classData[i+1];
			i += 2;
			descriptorIndex = (classData[i] << 8) + classData[i+1];
			i += 2;
			method = new Method(accessFlags, cpool[nameIndex].value, cpool[descriptorIndex].value, javaClass.$cappuccino);
			//method.debugPrint();
			attributesCount = (classData[i] << 8) + classData[i+1];
			i += 2;
			for(k = 0; k < attributesCount; k++)
			{
				attributeNameIndex = (classData[i] << 8) + classData[i+1];
				i += 2;
				attributeLength = (classData[i] << 24) + (classData[i+1] << 16) + (classData[i+2] << 8) + classData[i+3];
				i += 4;
				if(cpool[attributeNameIndex].value == "Code")
				{
					maxStack = (classData[i] << 8) + classData[i+1];
					i += 2;
					maxLocals = (classData[i] << 8) + classData[i+1];
					i += 2;
					codeLength = (classData[i] << 24) + (classData[i+1] << 16) + (classData[i+2] << 8) + classData[i+3];
					i += 4;
					code = [];
					for(l = 0; l < codeLength; l++)
					{
						code[l] = classData[i+l];
					}
					i += codeLength;
					codeAttr = new Code(maxStack, maxLocals, code);
					exceptionTablesCount = (classData[i] << 8) + classData[i+1];
					i += 2;
					exceptionTables = [];
					for(l = 0; l < exceptionTablesCount; l++)
					{
						startPC = (classData[i] << 8) + classData[i+1];
						i += 2;
						endPC = (classData[i] << 8) + classData[i+1];
						i += 2;
						handlerPC = (classData[i] << 8) + classData[i+1];
						i += 2;
						catchType = (classData[i] << 8) + classData[i+1];
						i += 2;
						exceptionTables.push({startPC:startPC, endPC:endPC, handlerPC:handlerPC, catchType:catchType});
					}
					codeAttr.exceptionTables = exceptionTables;
					//Codeの中のattributeは無視
					i = ignoreAttributes(classData, i);
				}
				else
				{
					i += attributeLength;
				}
			}
			method.codeAttr = codeAttr;
			//method.debugPrint();
			javaClass.$cappuccino.addMethod(method);

		}
		return javaClass;
	}

	var ignoreAttributes = function(classData, i)
	{
		var attributesCount = (classData[i] << 8) + classData[i+1];
		var attributeLength;
		i += 2;
		for(var j = 0; j < attributesCount; j++)
		{
			i += 2;
			attributeLength = (classData[i] << 24) + (classData[i+1] << 16) + (classData[i+2] << 8) + classData[i+3];
			i += 4 + attributeLength;
		}
		return i;
	}

	var classHash = {};

	var getJavaClass = function(className)
	{
		if(!classHash[className])
		{
			return null;
		}
		return classHash[className];
	}


	var loadClassfileAsync = function(className, javaThread, cbfunc, callMain, arg)
	{
		var xmlhttp = new XMLHttpRequest();
		var url = getClassfileURL(className);
		xmlhttp.open("GET", url, true);
		xmlhttp.onreadystatechange = function()
		{
			var ab;
			var ar;
			var javaClass;
			var superClass;
			var mainMethod;

			if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
			{
				ab = xmlhttp.response;
				ar = new Uint8Array(ab, 0, ab.byteLength);
				javaClass = loadJavaClass(ar);
				if(callMain)
				{
					mainMethod = javaClass.$cappuccino.findMethod("main", "([Ljava/lang/String;)V");
					javaThread.invoke(mainMethod, arg);
				}
				if(javaClass.$cappuccino.methods["<clinit>"] && javaClass.$cappuccino.methods["<clinit>"]["()V"])
				{
					//Threadをrunすると<clinit>が実行される
					javaThread.invoke(javaClass.$cappuccino.methods["<clinit>"]["()V"]);
				}
				//debugPrint(javaClass.$cappuccino.thisClassName + " is loaded");
				classHash[className] = javaClass;
				superClass = getJavaClass(javaClass.$cappuccino.superClassName);
				if(superClass)
				{
					javaClass.$cappuccino.superClass = superClass;
					cbfunc();
				}
				else
				{
					debugPrint(javaClass.$cappuccino.superClassName);
					loadClassfileAsync(javaClass.$cappuccino.superClassName, function()
					{
						javaClass.$cappuccino.superClass = getJavaClass(javaClass.$cappuccino.superClassName);
						cbfunc();
					});
				}
			}
		};
		xmlhttp.responseType = "arraybuffer";
		xmlhttp.send(null);
	}

	var JavaThread = function()
	{
		this.pc = 0;
		this.stackTop = 0;
		this.vmStack = [];
		this.currentMethod = null;
		this.firstMethod = null;
	}

	JavaThread.prototype.run = function()
	{
		var cfunc, ret, nextTop, numLocals, i, r, oldLength;
		while(true)
		{
			cfunc = this.currentMethod.getCompiledMethod();
			ret = cfunc(this);
			//ret = cfunc(this.vmStack, this.stackTop, this.pc, this.currentMethod.$cappuccino);
			if(ret.action == "invoke")
			{
				//debugPrint("invoke " + ret.method.name)
				//debugPrint(ret.method.paramLength);
				//debugPrint(ret.method.codeAttr.maxLocals);
				//次のスタックが始まる位置
				nextTop = this.vmStack.length - ret.method.paramLength;
				if(!ret.method.isStatic())
				{
					nextTop--;
				}
				//引数以外のローカル変数の数
				numLocals = ret.method.codeAttr.maxLocals - ret.method.paramLength;
				if(!ret.method.isStatic())
				{
					numLocals--;
				}
				for(i = 0; i < numLocals; i++)
				{
					this.vmStack.push(null);
				}
				this.vmStack.push(this.currentMethod);
				this.vmStack.push(this.stackTop);
				//現在のスタックフレームのサイズを保存
				this.vmStack.push(this.vmStack.length - ret.method.codeAttr.maxLocals - 2);
				this.vmStack.push(ret.pc);
				this.currentMethod = ret.method;
				this.stackTop = nextTop;
				this.pc = 0;
				//debugPrint("invoking " + ret.method.name)
				//for(i = 0; i < this.vmStack.length; i++)
				//	debugPrint(this.vmStack[i]);
				//debugPrint("stackTop=" + nextTop);
			}
			else if(ret.action == "return" || ret.action == "returnValue" || ret.action == "returnValueWide")
			{
				if(this.currentMethod == this.firstMethod)
				{
					//すべての関数の実行がおわったのでスレッドを終了する
					return;
				}
				else
				{
					r = this.stackTop + this.currentMethod.codeAttr.maxLocals;
					this.currentMethod = this.vmStack[r];
					this.stackTop = this.vmStack[r+1];
					oldLength = this.vmStack[r+2];
					this.pc = this.vmStack[r+3];
					//現在のスタックフレームを破棄
					while(this.vmStack.length > oldLength)
					{
						this.vmStack.pop();
					}
					if(ret.action == "returnValue")
					{
						this.vmStack.push(ret.value);
					}
					else if(ret.action == "returnValueWide")
					{
						this.vmStack.push(ret.value);
						this.vmStack.push(valueDummy);
					}
				}
			}
			else if(ret.action == "loadClass")
			{
				var javaThread = this;
				this.pc = ret.pc;
				loadClassfileAsync(ret.className, javaThread, function(){javaThread.run();});
				return;
			}
		}
	}

	JavaThread.prototype.invoke = function(method)
	{
		var nextTop, numLocals, i, r, oldLength;
		if(!this.firstMethod)
		{
			this.firstMethod = method;
		}
		for(i=1; i < arguments.length; i++)
		{
			this.vmStack.push(arguments[i]);
		}
		//次のスタックが始まる位置
		nextTop = this.vmStack.length - method.paramLength;
		if(!method.isStatic())
		{
			nextTop--;
		}
		//引数以外のローカル変数の数
		numLocals = method.codeAttr.maxLocals - method.paramLength;
		if(!method.isStatic())
		{
			numLocals--;
		}
		for(i = 0; i < numLocals; i++)
		{
			this.vmStack.push(null);
		}
		this.vmStack.push(this.currentMethod);
		this.vmStack.push(this.stackTop);
		//現在のスタックフレームのサイズを保存
		this.vmStack.push(this.vmStack.length - method.codeAttr.maxLocals - 2);
		this.vmStack.push(this.pc);
		this.currentMethod = method;
		this.stackTop = nextTop;
		this.pc = 0;
	}

	//組み込みクラスの定義
	//java/lang/Object
	var JavaObject = function() {}

	JavaObject.$cappuccino = new CVMInfo(JavaObject);

	var objectInit = new Method(0x00, '<init>', '()V');
	objectInit.codeAttr = new Code(0, 1, null);
	objectInit.compiledMethod = function(javaThread)
	{
		//debugPrint("object init");
		return {action: "return"};
	}
	
	JavaObject.$cappuccino.addMethod(objectInit);

	classHash['java/lang/Object'] = JavaObject;

	//java/io/PrintStrem
	var PrintStream = function() {}
	PrintStream.$cappuccino = new CVMInfo(PrintStream);
	var printlnInt = new Method(0x00, 'println', '(I)V');
	printlnInt.codeAttr = new Code(0, 2, null);
	printlnInt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		debugPrint(vmStack[stackTop+1].value);
		return {action:"return"};
	}
	PrintStream.$cappuccino.addMethod(printlnInt);

	var printlnString = new Method(0x00, "println", "(Ljava/lang/String;)V");
	printlnString.codeAttr = new Code(0, 2, null);
	printlnString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		debugPrint(vmStack[stackTop+1].value.toString());
		return {action:"return"};
	}
	PrintStream.$cappuccino.addMethod(printlnString);

	var printlnFloat = new Method(0x0000, "println", "(F)V");
	printlnFloat.codeAttr = new Code(0, 2, null);
	printlnFloat.compiledMethod = printlnInt.compiledMethod;
	PrintStream.$cappuccino.addMethod(printlnFloat);

	var printlnDouble = new Method(0x0000, "println", "(D)V");
	printlnDouble.codeAttr = new Code(0, 3, null);
	printlnDouble.compiledMethod = printlnInt.compiledMethod;
	PrintStream.$cappuccino.addMethod(printlnDouble);

	var printlnLong = new Method(0x0000, "println", "(J)V");
	printlnLong.codeAttr = new Code(0, 3, null);
	printlnLong.compiledMethod = printlnInt.compiledMethod;
	PrintStream.$cappuccino.addMethod(printlnLong);

	classHash["java/io/PrintStream"] = PrintStream;

	//java/lang/String
	var JavaString = function() {}
	JavaString.$cappuccino = new CVMInfo(JavaString);

	//これはJavaのtoStringではなくJavaScriptのtoString(ややこしいな…)
	JavaString.prototype.toString = function()
	{
		return this.str;
	}

	var stringInit = new Method(0x0000, "<init>", "(Ljava/lang/String;)V");
	stringInit.codeAttr = new Code(0, 2, null);
	stringInit.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		var thisObj = vmStack[stackTop];
		var arg = vmStack[stackTop+1];
		thisObj.str = arg.str;
		return {action:"return"};
	}
	JavaString.$cappuccino.addMethod(stringInit);
	classHash['java/lang/String'] = JavaString;

	var createJavaString = function(str)
	{
		var javaString = new JavaString();
		javaString.str = str;
		return javaString;
	}

	//java/lang/StringBuffer
	var StringBuilder = function() {};
	StringBuilder.$cappuccino = new CVMInfo(StringBuilder);
	var sbInit = new Method(0x0000, "<init>", "()V");
	sbInit.codeAttr = new Code(0, 1, null);
	sbInit.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		vmStack[stackTop].value.str = "";
		return {action:"return"};
	}
	StringBuilder.$cappuccino.addMethod(sbInit);

	var sbInitStr = new Method(0x0000, "<init>", "(Ljava/lang/String;)V");
	sbInitStr.codeAttr = new Code(0, 2, null);
	sbInitStr.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		vmStack[stackTop].value.str = vmStack[stackTop+1].value.str;
		return {action:"return"};
	}
	StringBuilder.$cappuccino.addMethod(sbInitStr);

	var appendInt = new Method(0x000, "append", "(I)Ljava/lang/StringBuilder;");
	appendInt.codeAttr = new Code(0, 2, null);
	appendInt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		var thisObj = vmStack[stackTop].value;
		var arg = vmStack[stackTop+1].value;
		thisObj.str = thisObj.str + arg;
		return {action:"returnValue", value:new ValueObject(thisObj)};
	}
	StringBuilder.$cappuccino.addMethod(appendInt);

	var appendFloat = new Method(0x0000, "append", "(F)Ljava/lang/StringBuilder;");
	appendFloat.codeAttr = new Code(0, 2, null);
	appendFloat.compiledMethod = appendInt.compiledMethod;
	StringBuilder.$cappuccino.addMethod(appendFloat);

	var appendDouble = new Method(0x0000, "append", "(D)Ljava/lang/StringBuilder;");
	appendDouble.codeAttr = new Code(0, 3, null);
	appendDouble.compiledMethod = appendInt.compiledMethod;
	StringBuilder.$cappuccino.addMethod(appendDouble);

	var appendLong = new Method(0x0000, "append", "(J)Ljava/lang/StringBuilder;");
	appendLong.codeAttr = new Code(0, 3, null);
	appendLong.compiledMethod = appendInt.compiledMethod;
	StringBuilder.$cappuccino.addMethod(appendLong);

	var appendString = new Method(0x0000, "append", "(Ljava/lang/String;)Ljava/lang/StringBuilder;");
	appendString.codeAttr = new Code(0, 2, null);
	appendString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		var thisObj = vmStack[stackTop].value;
		var arg = vmStack[stackTop+1].value;
		thisObj.str = thisObj.str + arg.str;
		return {action:"returnValue", value:new ValueObject(thisObj)};
	}
	StringBuilder.$cappuccino.addMethod(appendString);

	var sbToString = new Method(0x0000, "toString", "()Ljava/lang/String;");
	sbToString.codeAttr = new Code(0, 1, null);
	sbToString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		var javaString = createJavaString(vmStack[stackTop].value.str);
		return {action:"returnValue", value:new ValueObject(javaString)};
	}
	StringBuilder.$cappuccino.addMethod(sbToString);

	classHash["java/lang/StringBuilder"] = StringBuilder;

	//java/lang/Math
	var JavaMath = function() {}
	JavaMath.$cappuccino = new CVMInfo(JavaMath);
	JavaMath.PI = new ValueDouble(Math.PI);

	var sqrt = new Method(0x0008, "sqrt", "(D)D");
	sqrt.codeAttr = new Code(0, 2, null);
	sqrt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		return {action: "returnValueWide", value: new ValueDouble(Math.sqrt(vmStack[stackTop].value))};
	}
	JavaMath.$cappuccino.addMethod(sqrt);
	
	var random = new Method(0x0008, "random", "()D");
	random.codeAttr = new Code(0, 2, null);
	random.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		return {action: "returnValueWide", value: new ValueDouble(Math.random())};
	}
	JavaMath.$cappuccino.addMethod(random);

	var sin = new Method(0x0008, "sin", "(D)D");
	sin.codeAttr = new Code(0, 2, null);
	sin.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		return {action: "returnValueWide", value: new ValueDouble(Math.sin(vmStack[stackTop].value))};
	}
	JavaMath.$cappuccino.addMethod(sin);

	var min = new Method(0x0008, "min", "(II)I");
	min.codeAttr = new Code(0, 2, null);
	min.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		var a = vmStack[stackTop].value;
		var b = vmStack[stackTop+1].value;
		if(a>b)
		{
			return {action: "returnValue", value: new ValueInteger(b)};
		}
		else
		{
			return {action: "returnValue", value: new ValueInteger(a)};
		}
	}
	JavaMath.$cappuccino.addMethod(min);

	var abs = new Method(0x0008, "abs", "(D)D");
	abs.codeAttr = new Code(0, 2, null);
	abs.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		return {action: "returnValueWide", value: new ValueDouble(Math.abs(vmStack[stackTop].value))};
	}
	JavaMath.$cappuccino.addMethod(abs);

	var absInt = new Method(0x0008, "abs", "(I)I");
	absInt.codeAttr = new Code(0, 2, null);
	absInt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackTop = javaThread.stackTop;
		return {action: "returnValue", value: new ValueInteger(Math.abs(vmStack[stackTop].value))};
	}
	JavaMath.$cappuccino.addMethod(absInt);

	classHash["java/lang/Math"] = JavaMath;

	//java/lang/System
	var System = function() {}
	System.$cappuccino = new CVMInfo(System);
	System.out = new ValueObject(new PrintStream());

        var currentTimeMillis = new Method(0x0008, "currentTimeMillis", "()J");
	currentTimeMillis.codeAttr = new Code(0, 0, null);
	currentTimeMillis.compiledMethod = function(javaThread)
	{
		var dd = new Date();
		return {action: "returnValueWide", value:new ValueLong(dd.getTime())}
	}
	System.$cappuccino.addMethod(currentTimeMillis);

	var getProperty = new Method(0x0008, "getProperty", "(Ljava/lang/String;)Ljava/lang/String;");
	getProperty.codeAttr = new Code(0, 1, null);
	getProperty.compiledMethod = function(javaThread)
	{
		var propString = createJavaString("CappuccinoVM");
		return {action: "returnValue", value: new ValueObject(propString)}
	}
	System.$cappuccino.addMethod(getProperty);

	classHash["java/lang/System"] = System;

	//グローバル名前空間オブジェクト
	CappuccinoVM = 
	{
		/*
		startMain: function(className)
		{
			var javaClass = getJavaClass(className);
			var mainMethod = javaClass.$cappuccino.findMethod("main", "([Ljava/lang/String;)V");
			var i;
			var args = [];
			for (i=1; i < arguments.length; i++)
			{
				args[i-1] = new ValueObject(createJavaString(arguments[i]));
			}
			new JavaThread(mainMethod, [new ValueObject(args)]).run();
		},
		*/

		startMain: function(className)
		{
			var args = [];
			var javaThread = new JavaThread();

			for (i=1; i < arguments.length; i++)
			{
				args[i-1] = new ValueObject(createJavaString(arguments[i]));
			}

			loadClassfileAsync(className, javaThread, function(){javaThread.run();}, true, new ValueObject(args));
		},

		debugPrint: debugPrint,
		getJavaClass: getJavaClass,
		makeArray: makeArray,
		createJavaString: createJavaString,
		ValueInteger: ValueInteger,
		ValueFloat: ValueFloat,
		ValueDouble: ValueDouble,
		ValueObject: ValueObject,
		ValueDummy: ValueDummy,
		valueDummy: valueDummy
	}
}
