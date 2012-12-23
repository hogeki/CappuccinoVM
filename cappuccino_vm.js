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

	const TYPE_INTEGER = 0x00;
	const TYPE_FLOAT = 0x01;
	const TYPE_DOUBLE = 0x02;
	const TYPE_LONG = 0x03;
	const TYPE_OBJECT = 0x04;
	const TYPE_DUMMY = 0x05;
	const TYPE_ARRAY = 0x10;

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
				//this.valueClass = ValueInteger;
				this.fieldType = TYPE_INTEGER;
				break;
			case "F":
				//this.valueClass = ValueFloat;
				this.fieldType = TYPE_FLOAT;
				break;
			case "D":
				//this.valueClass = ValueDouble;
				this.fieldType = TYPE_DOUBLE;
				break;
			case "J":
				//this.valueClass = ValueLong;
				this.fieldType = TYPE_LONG;
				break;
			case "L":
			case "[":
				//this.valueClass = ValueObject;
				this.fieldType = TYPE_OBJECT;
				break;
			default:
				//this.valueClass = ValueInteger;
				this.fieldType = TYPE_INTEGER;
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
		this.value = createJavaString(cpool[this.stringIndex].value);
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
		this.value = bytes;
		//this.value = new ValueInteger(bytes);
	}

	ConstInteger.prototype.resolve = function(cpool) {}

	ConstInteger.prototype.debugPrint = function()
	{
		debubPrint("Integer " + this.value);
	}

	var ConstLong = function(tag, high, low)
	{
		var tmp;
		this.tag = tag;
		//32bitずつhighとlowに分けて格納
		//符号はhighのbit32に持たせる(2の補数表現ではない)
		//オペランドスタック上ではhighが上でlowが下
		if(high & 0x80000000)
		{
			//負の数なので絶対値を取り出す
			//ビットを反転して1足す
			high = ~high >>> 0;
			low = ~low >>> 0;
			low = low + 1;
			if( low > 0xffffffff)
			{
				low = 0;
				high = high + 1;
			}
			high += Math.pow(2, 32);
		}
		this.high = high;
		this.low = low >>> 0;
	}

	ConstLong.prototype.resolve = function(cpool) {}

	ConstLong.prototype.debugPrint = function()
	{
		debugPrint("Long " + this.low);
	}

	var ConstFloat = function(tag, bytes)
	{
		this.tag = tag;

		var s = ((bytes >>> 31) == 1) ? -1 : 1;
		var e = (bytes >>> 23) & 0xff;
		var m = (e == 0) ?  (bytes & 0x7fffff) << 1 : (bytes & 0x7fffff) | 0x800000;
		this.value = s * m * Math.pow(2, e-150);
		//this.value = new ValueFloat(s * m * Math.pow(2, e-150));
	}

	ConstFloat.prototype.resolve = function(cpool) {}

	ConstFloat.prototype.debugPrint = function()
	{
		debugPrint("Float " + this.value);
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

		this.value = s * m * Math.pow(2, e-1075);
		//debugPrint("double value=" + this.value);
		//this.value = new ValueDouble(s * m * Math.pow(2, e-1075));
	}

	ConstDouble.prototype.resolve = function(cpool) {}

	ConstDouble.prototype.debugPrint = function()
	{
		debugPrint("Double " + this.value);
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
	const F2L = 0x8c;
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
	const ATHROW = 0xbf;
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
		jsCodes.push("vmStack[stackBase+" + code[i+1] + "] = vmStack[--thread.stackPtr];");
		return i + 2;
	}

	Method.instTable[DSTORE] = Method.instTable[LSTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		jsCodes.push("vmStack[stackBase+" + code[i+1] + "] = vmStack[thread.stackPtr];");
		jsCodes.push("vmStack[stackBase+" + (code[i+1] + 1) + "] = vmStack[thread.stackPtr+1];");
		return i + 2;
	}

	Method.instTable[ISTORE_0] =  Method.instTable[ASTORE_0] = Method.instTable[FSTORE_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackBase] = vmStack[--thread.stackPtr];");
		return i + 1;
	}

	Method.instTable[DSTORE_0] = Method.instTable[LSTORE_0] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2");
		jsCodes.push("vmStack[stackBase] = vmStack[thread.stackPtr];");
		jsCodes.push("vmStack[stackBase+1] = vmStack[thread.stackPtr+1];");
		return i + 1;
	}

	Method.instTable[ISTORE_1] = Method.instTable[ASTORE_1] = Method.instTable[FSTORE_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackBase+1] = vmStack[--thread.stackPtr];");
		return i + 1;
	}

	Method.instTable[DSTORE_1] = Method.instTable[LSTORE_1] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		jsCodes.push("vmStack[stackBase+1] = vmStack[thread.stackPtr];");
		jsCodes.push("vmStack[stackBase+2] = vmStack[thread.stackPtr+1];");
		return i + 1;
	}

	Method.instTable[ISTORE_2] = Method.instTable[ASTORE_2] = Method.instTable[FSTORE_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackBase+2] = vmStack[--thread.stackPtr];");
		return i + 1;
	}

	Method.instTable[DSTORE_2] = Method.instTable[LSTORE_2] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		jsCodes.push("vmStack[stackBase+2] = vmStack[thread.stackPtr];");
		jsCodes.push("vmStack[stackBase+3] = vmStack[thread.stackPtr+1];");
		return i + 1;
	}

	Method.instTable[ISTORE_3] = Method.instTable[ASTORE_3] = Method.instTable[FSTORE_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[stackBase+3] = vmStack[--thread.stackPtr];");
		return i + 1;
	}

	Method.instTable[DSTORE_3] = Method.instTable[LSTORE_3] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		jsCodes.push("vmStack[stackBase+3] = vmStack[thread.stackPtr];");
		jsCodes.push("vmStack[stackBase+4] = vmStack[thread.stackPtr+1];");
		return i + 1;
	}

	Method.instTable[ILOAD] = Method.instTable[ALOAD] = Method.instTable[FLOAD]  = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = vmStack[stackBase+" + code[i+1] + "];"); 
		return i + 2;
	}

	Method.instTable[DLOAD] = Method.instTable[LLOAD] = function(code, i, jsCodes)
	{
		//jsCodes.push("vmStack.push(vmStack[stackTop+" + code[i+1] +"].duplicate());");
		//jsCodes.push("vmStack.push(CappuccinoVM.valueDummy);");
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[stackBase+" + code[i+1] + "];"); 
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[stackBase+" + (code[i+1]+1)+ "];"); 
		jsCodes.push("thread.stackPtr+=2;");
		return i + 2;
	}

	Method.instTable[ILOAD_0] = Method.instTable[ALOAD_0] = Method.instTable[FLOAD_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = vmStack[stackBase];"); 
		return i + 1;
	}

	Method.instTable[DLOAD_0] = Method.instTable[LLOAD_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[stackBase];"); 
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[stackBase+1];"); 
		jsCodes.push("thread.stackPtr+=2;");
		return i + 1;
	}

	Method.instTable[ILOAD_1] = Method.instTable[ALOAD_1] = Method.instTable[FLOAD_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = vmStack[stackBase+1];"); 
		return i + 1;
	}

	Method.instTable[DLOAD_1] = Method.instTable[LLOAD_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[stackBase+1];"); 
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[stackBase+2];"); 
		jsCodes.push("thread.stackPtr+=2;");
		return i + 1;
	}

	Method.instTable[ILOAD_2] = Method.instTable[ALOAD_2] = Method.instTable[FLOAD_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = vmStack[stackBase+2];"); 
		return i + 1;
	}

	Method.instTable[DLOAD_2] = Method.instTable[LLOAD_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[stackBase+2];"); 
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[stackBase+3];"); 
		jsCodes.push("thread.stackPtr+=2;");
		return i + 1;
	}

	Method.instTable[ILOAD_3] = Method.instTable[ALOAD_3] = Method.instTable[FLOAD_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = vmStack[stackBase+3];"); 
		return i + 1;
	}

	Method.instTable[DLOAD_3] = Method.instTable[LLOAD_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[stackBase+3];"); 
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[stackBase+4];"); 
		jsCodes.push("thread.stackPtr+=2;");
		return i + 1;
	}

	Method.instTable[IASTORE] = Method.instTable[AASTORE] = Method.instTable[FASTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("obj = vmStack[--thread.stackPtr];");
		jsCodes.push("obj[operand1] = operand2;");
		return i + 1;
	}

	Method.instTable[DASTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("--thread.stackPtr;");
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("obj = vmStack[--thread.stackPtr];");
		jsCodes.push("obj[operand1] = operand2;");
		return i + 1;
	}

	Method.instTable[LASTORE] = function(code, i, jsCodes)
	{
		jsCodes.push("operand2 = {high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]};");
		jsCodes.push("operand1 = vmStack[thread.stackPtr-3];");
		jsCodes.push("obj = vmStack[thread.stackPtr-4];");
		jsCodes.push("obj[operand1] = operand2;");
		jsCodes.push("thread.stackPtr -= 4;");
		return i + 1;
	}

	Method.instTable[IALOAD] = Method.instTable[AALOAD] = Method.instTable[FALOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("obj = vmStack[thread.stackPtr-1];");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj[operand1];");
		return i + 1;
	}

	Method.instTable[DALOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[thread.stackPtr-1];");
		jsCodes.push("obj = vmStack[thread.stackPtr-2];");
		jsCodes.push("vmStack[thread.stackPtr-2] = obj[operand1];");
		jsCodes.push("vmStack[thread.stackPtr-1] = 0;");
		return i + 1;
	}

	Method.instTable[LALOAD] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[thread.stackPtr-1];");
		jsCodes.push("obj = vmStack[thread.stackPtr-2];");
		jsCodes.push("vmStack[thread.stackPtr-2] = obj[operand1].low;");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj[operand1].high;");
		return i + 1;
	}

	Method.instTable[POP] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[POP2] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[DUP] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr++;");
		return i + 1;
	}

	Method.instTable[DUP2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr] = vmStack[thread.stackPtr-2];");
		jsCodes.push("vmStack[thread.stackPtr+1] = vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr+=2;");
		return i + 1;
	}

	Method.instTable[SWAP] = function(code, i, jsCodes)
	{
		jsCodes.push("operand2 = vmStack[thread.stackPtr-1];");
		jsCodes.push("operand1 = vmStack[thread.stackPtr-2];");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand2;");
		jsCodes.push("vmStack[thread.stackPtr-1] = operand1;");
		return i + 1;
	}

	Method.instTable[BIPUSH] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = " + get8BitsSigned(code[i+1]) + ";");
		return i + 2;
	}

	Method.instTable[SIPUSH] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = " + get16BitsSigned((code[i+1] << 8) + code[i+2]) + ";");
		return i + 3;
	}

	Method.instTable[ACONST_NULL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = null;");
		return i + 1;
	}

	Method.instTable[ICONST_M1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = -1;");
		return i + 1;
	}

	Method.instTable[ICONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[ICONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 1;");
		return i + 1;
	}

	Method.instTable[ICONST_2] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 2;");
		return i + 1;
	}

	Method.instTable[ICONST_3] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 3;");
		return i + 1;
	}

	Method.instTable[ICONST_4] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 4;");
		return i + 1;
	}

	Method.instTable[LCONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[LCONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 1;");
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[DCONST_0] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[DCONST_1] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 1;");
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[ICONST_5] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 5;");
		return i + 1;
	}

	Method.instTable[IFEQ] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1==0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1!=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFLT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1<0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFLE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1<=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFGT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1>0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFGE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1>=0){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPEQ] = Method.instTable[IF_ACMPEQ] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1==operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPNE] = Method.instTable[IF_ACMPNE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1!=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPLT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1<operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPLE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1<=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPGT] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1>operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IF_ICMPGE] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1>=operand2){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNULL] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1 == null){");
		addr = i + get16BitsSigned((code[i+1] << 8) + code[i+2]);
		jsCodes.push("pc = " + addr + "; continue;}");
		return i + 3;
	}

	Method.instTable[IFNONNULL] = function(code, i, jsCodes)
	{
		var addr;
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
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
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
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
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
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
		jsCodes.push("vmStack[stackBase+" + code[i+1] + "]+=" + get8BitsSigned(code[i+2]) + ";");
		return i + 3;
	}

	Method.instTable[IADD] = Method.instTable[FADD] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] += vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}


	Method.instTable[DADD] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-4] += vmStack[thread.stackPtr-2];");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[LADD] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doAddLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4]=obj.low;");
		jsCodes.push("vmStack[thread.stackPtr-3]=obj.high;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[ISUB] = Method.instTable[FSUB] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] -= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[DSUB] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-4] -= vmStack[thread.stackPtr-2];");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[LSUB] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doSubLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4]=obj.low;");
		jsCodes.push("vmStack[thread.stackPtr-3]=obj.high;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[IMUL] = Method.instTable[FMUL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] *= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[DMUL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-4] *= vmStack[thread.stackPtr-2];");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[LMUL] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doMulLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4]=obj.low;");
		jsCodes.push("vmStack[thread.stackPtr-3]=obj.high;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[IDIV] = Method.instTable[FDIV] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] = Math.floor(vmStack[thread.stackPtr-2]/vmStack[thread.stackPtr-1]);");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[DDIV] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-4] /= vmStack[thread.stackPtr-2];");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[LDIV] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doDivLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4]=obj.lowQuot;");
		jsCodes.push("vmStack[thread.stackPtr-3]=obj.highQuot;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[IREM] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] %= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LREM] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doDivLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4]=obj.lowMod;");
		jsCodes.push("vmStack[thread.stackPtr-3]=obj.highMod;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[INEG] = Method.instTable[FNEG] =  function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-1] *= -1;");
		return i + 1;
	}

	Method.instTable[DNEG] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] *= -1;");
		return i + 1;
	}

	Method.instTable[LNEG] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.doMulLong(vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2], Math.pow(2, 32), 1);");
		jsCodes.push("vmStack[thread.stackPtr-2]=obj.low;");
		jsCodes.push("vmStack[thread.stackPtr-1]=obj.high;");
		return i + 1;
	}

	Method.instTable[LCMP] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1=CappuccinoVM.doCmpLong(vmStack[thread.stackPtr-3], vmStack[thread.stackPtr-4], vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-4] = operand1")
		jsCodes.push("thread.stackPtr-=3;");
		return i + 1;
	}

	Method.instTable[DCMPL] = Method.instTable[DCMPG] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr--;");
		jsCodes.push("operand2 = vmStack[--thread.stackPtr];");
		jsCodes.push("thread.stackPtr--;");
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("if(operand1 > operand2){vmStack[thread.stackPtr++] = 1;}")
		jsCodes.push("else if(operand1 == operand2){vmStack[thread.stackPtr++] = 0;}");
		jsCodes.push("else {vmStack[thread.stackPtr++] = -1;}");
		return i + 1;
	}

	Method.instTable[ISHL] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] <<= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LSHL] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-2], low:vmStack[thread.stackPtr-3]});");
		jsCodes.push("operand2 = vmStack[thread.stackPtr-1];");
		jsCodes.push("if(operand2 < 32) {");
		jsCodes.push("mask = (~0 >>> 0) << (32-operand2);");
		jsCodes.push("operand1.high = ((operand1.high << operand2) | ((operand1.low & mask) >>> (32-operand2))) >>> 0;");
		jsCodes.push("operand1.low = (operand1.low << operand2) >>> 0;");
		jsCodes.push("}else{");
		jsCodes.push("operand1.high = (operand1.low << (operand2 - 32)) >>> 0;");
		jsCodes.push("operand1.low = 0;");
		jsCodes.push("}");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.low;");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[ISHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] >>= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-2], low:vmStack[thread.stackPtr-3]});");
		jsCodes.push("operand2 = vmStack[thread.stackPtr-1];");
		jsCodes.push("if(operand2 < 32) {");
		jsCodes.push("mask = (~0 >>> 0) >>> (32-operand2);");
		jsCodes.push("operand1.low = ((operand1.low >>> operand2) | ((operand1.high & mask) << (32-operand2))) >>> 0;");
		jsCodes.push("operand1.high = (operand1.high >> operand2) >>> 0;");
		jsCodes.push("}else{");
		jsCodes.push("operand1.low = (operand1.high >> (operand2 - 32)) >>> 0;");
		jsCodes.push("if(operand1.high & 0x80000000){operand1.high = 0xffffffff;}");
		jsCodes.push("else{operand1.high = 0;}");
		jsCodes.push("}");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.low;");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[IUSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] >>>= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LUSHR] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-2], low:vmStack[thread.stackPtr-3]});");
		jsCodes.push("operand2 = vmStack[thread.stackPtr-1];");
		jsCodes.push("if(operand2 < 32) {");
		jsCodes.push("mask = (~0 >>> 0) >>> (32-operand2);");
		jsCodes.push("operand1.low = ((operand1.low >>> operand2) | ((operand1.high & mask) << (32-operand2))) >>> 0;");
		jsCodes.push("operand1.high = (operand1.high >>> operand2) >>> 0;");
		jsCodes.push("}else{");
		jsCodes.push("operand1.low = (operand1.high >>> (operand2 - 32)) >>> 0;");
		jsCodes.push("operand1.high = 0;");
		jsCodes.push("}");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.low;");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[IAND] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] &= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LAND] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-3], low:vmStack[thread.stackPtr-4]});");
		jsCodes.push("operand2 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]});");
		jsCodes.push("operand1.low &= operand2.low;");
		jsCodes.push("operand1.high &= operand2.high;");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-4] = operand1.low;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[IOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] |= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LOR] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-3], low:vmStack[thread.stackPtr-4]});");
		jsCodes.push("operand2 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]});");
		jsCodes.push("operand1.low |= operand2.low;");
		jsCodes.push("operand1.high |= operand2.high;");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-4] = operand1.low;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[IXOR] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] ^= vmStack[thread.stackPtr-1];");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[LXOR] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-3], low:vmStack[thread.stackPtr-4]});");
		jsCodes.push("operand2 = CappuccinoVM.getOpponentFromSign({high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]});");
		jsCodes.push("operand1.low ^= operand2.low;");
		jsCodes.push("operand1.high ^= operand2.high;");
		jsCodes.push("operand1 = CappuccinoVM.getSignFromOpponent(operand1);");
		jsCodes.push("vmStack[thread.stackPtr-3] = operand1.high;");
		jsCodes.push("vmStack[thread.stackPtr-4] = operand1.low;");
		jsCodes.push("thread.stackPtr-=2;");
		return i + 1;
	}

	Method.instTable[I2C] = function(code, i, jsCodes)
	{
		//jsCodes.push("vmStack.push(vmStack.pop().toChar());");
		jsCodes.push("vmStack[thread.stackPtr-1] &= 0xffff;");
		return i + 1;
	}

	Method.instTable[I2B] = function(code, i, jsCodes)
	{
		//jsCodes.push("vmStack.push(vmStack.pop().toByte());");
		jsCodes.push("vmStack[thread.stackPtr-1] &= 0xff;");
		return i + 1;
	}

	Method.instTable[I2S] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-1] &= 0xffff;");
		return i + 1;
	}

	Method.instTable[I2F] = function(code, i, jsCodes)
	{
		return i + 1;
	}

	Method.instTable[I2D] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[I2L] = function(code, i, jsCodes)
	{
		jsCodes.push("obj = CappuccinoVM.getLongFromInt(vmStack[thread.stackPtr-1]);");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj.low;");
		jsCodes.push("vmStack[thread.stackPtr++] = obj.high;");
		return i + 1;
	}


	Method.instTable[F2I] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-1] = Math.floor(vmStack[thread.stackPtr-1]);");
		return i + 1;
	}

	Method.instTable[F2D] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr++] = 0;");
		return i + 1;
	}

	Method.instTable[F2L] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.getLongFromDouble(vmStack[thread.stackPtr-1]);");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj.low;");
		jsCodes.push("vmStack[thread.stackPtr++] = obj.high;");
		return i + 1;
	}

	Method.instTable[L2I] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1=CappuccinoVM.getDoubleFromLong(vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1;");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[L2F] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1=CappuccinoVM.getDoubleFromLong(vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1;");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[L2D] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1=CappuccinoVM.getDoubleFromLong(vmStack[thread.stackPtr-1], vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-2] = operand1;");
		return i + 1;
	}


	Method.instTable[D2I] = function(code, i, jsCodes)
	{
		jsCodes.push("vmStack[thread.stackPtr-2] = Math.floor(vmStack[thread.stackPtr-2]);");
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[D2F] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr--;");
		return i + 1;
	}

	Method.instTable[D2L] = function(code, i, jsCodes)
	{
		jsCodes.push("obj=CappuccinoVM.getLongFromDouble(vmStack[thread.stackPtr-2]);");
		jsCodes.push("vmStack[thread.stackPtr-2] = obj.low;");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj.high;");
		return i + 1;
	}

	////Longの実装////
	/*
	memo:
	highのbit32を符号bitとする
	オペランドスタック上ではlowが下,highが上
	*/
	var addAbsLong = function(highX, lowX, highY, lowY)
	{
		var highZ, lowZ;
		var rad = Math.pow(2, 32)
		
		lowZ = lowX + lowY;
		highZ = highX + highY + Math.floor(lowZ / rad); 
		lowZ = lowZ % rad;
		return {high:highZ, low:lowZ};
	}

	//X >= Yじゃないとダメ
	var subAbsLong = function(highX, lowX, highY, lowY)
	{
		var highZ, lowZ;
		var rad = Math.pow(2, 32);

		lowX += rad; 
		lowZ = lowX - lowY;
		highZ = highX - highY;
		if(lowZ >= rad)
		{
			lowZ -= rad;
		}
		else
		{
			highZ--;
		}
		return {high:highZ, low:lowZ};
	}

	var cmpAbsLong = function(highX, lowX, highY, lowY)
	{

		if(highX > highY)
		{
			return 1;
		}
		else if(highX == highY)
		{
			if(lowX > lowY)
			{
				return 1;
			}
			else if(lowX == lowY)
			{
				return 0;
			}
			else
			{
				return -1;
			}
		}
		else
		{
			return -1;
		}
	}

	var doCmpLong = function(highX, lowX, highY, lowY)
	{
		var signX, signY;
		var rad = Math.pow(2, 32);

		signX = Math.floor(highX / rad) >>> 0;
		highX = highX % rad >>> 0;
		signY = Math.floor(highY / rad) >>> 0;
		highY = highY % rad >>> 0;
		if(signX == 0 && signY == 0)
		{
			return cmpAbsLong(highX, lowX, highY, lowY);
		}
		else if(signX == 0 && signY == 1)
		{
			return 1;
		}
		else if(signX == 1 && signY == 0)
		{
			return -1;
		}
		else
		{
			return cmpAbsLong(highX, lowX, highY, lowY) * -1;
		}
	}

	var doAddLong = function(highX, lowX, highY, lowY)
	{
		var signX, signY;
		var Z;
		var res;
		var rad = Math.pow(2, 32);

		signX = Math.floor(highX / rad) >>> 0;
		highX = highX % rad >>> 0;
		signY = Math.floor(highY / rad) >>> 0;
		highY = highY % rad >>> 0;

		if(signX == signY)
		{
			Z = addAbsLong(highX, lowX, highY, lowY);
			Z.high += rad * signX;
		}
		else
		{
			res = cmpAbsLong(highX, lowX, highY, lowY);
			if(res == 1)
			{
				Z = subAbsLong(highX, lowX, highY, lowY);
				Z.high += rad * signX;
			}
			else if(res == 0)
			{
				//符号が違って絶対値が等しければ答えは0
				Z = {high:0, low:0};
			}
			else
			{
				Z = subAbsLong(highY, lowY, highX, lowX);
				Z.high += rad * signY;
			}
		}
		return Z;
	}

	var doSubLong = function(highX, lowX, highY, lowY)
	{
		var signX, signY;
		var Z;
		var res;
		var rad = Math.pow(2, 32);

		signX = Math.floor(highX / rad) >>> 0;
		highX = highX % rad >>> 0;
		signY = Math.floor(highY / rad) >>> 0;
		highY = highY % rad >>> 0;

		if(signX == 0)
		{
			if(signY == 0)
			{
				res = cmpAbsLong(highX, lowX, highY, lowY);
				if(res == 1)
				{
					Z = subAbsLong(highX, lowX, highY, lowY);
				}
				else if(res == 0)
				{
					Z = {high:0, low:0};
				}
				else
				{
					Z = subAbsLong(highY, lowY, highX, lowX);
					Z.high += rad;
				}
			}
			else
			{
				Z = addAbsLong(highX, lowX, highY, lowY);
			}
		}
		else
		{
			if(signY == 0)
			{
				Z = addAbsLong(highX, lowX, highY, lowY);
				Z.high += rad;
			}
			else
			{
				res = cmpAbsLong(highX, lowX, highY, lowY);
				if(res == 1)
				{
					Z = subAbsLong(highX, lowX, highY, lowY);
					Z.high += rad;
				}
				else if(res == 0)
				{
					Z = {high:0, low:0};
				}
				else
				{
					Z = subAbsLong(highY, lowY, highX, lowX);
				}
			}
		}
		return Z;
	}

	var doMulLong = function(highX, lowX, highY, lowY)
	{
		var signX, signY;
		var buffX = [];
		var buffY = [];
		var buffZ = [];
		var i, j, tmp;
		var Z = {high:0, low:0};
		var rad = Math.pow(2, 32);

		signX = Math.floor(highX / rad) >>> 0;
		highX = highX % rad >>> 0;
		signY = Math.floor(highY / rad) >>> 0;
		highY = highY % rad >>> 0;

		//16bitごとに分割
		buffX[0] = (lowX & 0x0000ffff) >>> 0;
		buffX[1] = lowX >>> 16;
		buffX[2] = (highX & 0x0000ffff) >>> 0;
		buffX[3] = highX >>> 16;
		buffY[0] = (lowY & 0x0000ffff) >>> 0;
		buffY[1] = lowY >>> 16;
		buffY[2] = (highY & 0x0000ffff) >>> 0;
		buffY[3] = highY >>> 16;

		for(i=0; i<8; i++)
		{
			buffZ[i] = 0;
		}

		for(i=0; i<4; i++)
		{
			tmp = 0;
			for(j=0; j<4; j++)
			{
				tmp += buffX[i] * buffY[j];
				tmp += buffZ[i+j];
				buffZ[i+j] = (tmp & 0x0000ffff) >>> 0;
				tmp >>>= 16;
			}
			buffZ[i+j] = (tmp & 0x0000ffff) >>> 0;
		}

		Z.low = (buffZ[0] + (buffZ[1] << 16)) >>> 0;
		Z.high = (buffZ[2] + (buffZ[3] << 16)) >>> 0;

		if(signX != signY && (Z.low != 0 || Z.high != 0))
		{
			Z.high += rad;
		}
		return Z;
	}

	var cmpLongBuff = function(buffX, buffY)
	{
		var i;
		for(i = 3; i >= 0; i--)
		{
			if(buffX[i] > buffY[i])
			{
				return 1;
			}
			else if(buffX[i] == buffY[i])
			{
				continue;
			}
			else
			{
				return -1;
			}
			return 0;
		}
	}

	var subLongBuff = function(buffX, buffY)
	{
		var tmp;
		var rad = Math.pow(2, 16);
		var i;

		tmp = 0;
		for(i = 0; i < 4; i++)
		{
			tmp = rad + buffX[i] - buffY[i] - tmp;
			buffX[i] = (tmp & 0xffff) >>> 0;
			if(tmp & 0x10000)
			{
				tmp = 0;
			}
			else
			{
				tmp = 1;
			}
		}
	}

	var doDivLong = function(highX, lowX, highY, lowY)
	{
		var signX, signY;
		var buffW = [];
		var buffX = [];
		var buffY = [];
		var buffZ = [];
		var sizeX, sizeY, sizeZ;
		var i, j, tmp, q;
		var rad = Math.pow(2, 32);
		var ret = {highQuot:0, lowQuot:0, highMod:0, lowMod:0};

		signX = Math.floor(highX / rad) >>> 0;
		highX = highX % rad >>> 0;
		signY = Math.floor(highY / rad) >>> 0;
		highY = highY % rad >>> 0;

		//16bitごとに分割
		buffX[0] = (lowX & 0x0000ffff) >>> 0;
		buffX[1] = lowX >>> 16;
		buffX[2] = (highX & 0x0000ffff) >>> 0;
		buffX[3] = highX >>> 16;
		buffY[0] = (lowY & 0x0000ffff) >>> 0;
		buffY[1] = lowY >>> 16;
		buffY[2] = (highY & 0x0000ffff) >>> 0;
		buffY[3] = highY >>> 16;
		buffZ[0] = buffZ[1] = buffZ[2] = buffZ[3] = 0;

		sizeX = 0;
		for(i=3; i>=0; i--)
		{
			if(buffX[i] > 0)
			{
				sizeX = i + 1;
				break;
			}
		}

		if(sizeX == 0)
		{
			return {highQuot:0, lowQuot:0, highMod:0, lowMod:0};
		}

		sizeY = 0;
		for(i=3; i>=0; i--)
		{
			if(buffY[i] > 0)
			{
				sizeY = i + 1;
				break;
			}
		}

		if(sizeY == 0)
		{
			throw Error("divide by 0(long)");
		}

		sizeZ = sizeX - sizeY + 1;
		q = Math.floor(buffX[sizeX-1] / buffY[sizeY-1]);
		if(q == 0)
		{
			if(sizeX >= 2)
			{
				q = Math.floor((((buffX[sizeX-1] << 16) + buffX[sizeX-2]) >>> 0) / buffY[sizeY-1]);
				sizeZ--;
			}
			else
			{
				return {highQuot:0, lowQuot:0, highMod:highX, lowMod:lowX};
			}
		}
		i = sizeZ - 1;
		while(true)
		{
			while(true)
			{
				for(j = 0; j < 5; j++)
				{
					buffW[j] = 0;
				}

				if(q == 0)
				{
					break;
				}

				tmp = 0;
				for(j=0; j < sizeY; j++)
				{
					tmp += buffY[j] * q;
					buffW[j+i] = (tmp & 0x0000ffff) >>> 0;
					tmp >>>= 16;
				}
				buffW[j+i] = tmp;
				if(cmpLongBuff(buffX, buffW) != -1)
				{
					break;
				}
				q--;
			}
			buffZ[i--] = q;
			subLongBuff(buffX, buffW);
			if(i == -1)
			{
				break;
			}
			sizeX = 0;
			for(j=3; j>=0; j--)
			{
				if(buffX[j] != 0)
				{
					sizeX = j + 1;
					break;
				}
			}
			if(sizeX >= 2)
			{
				q = Math.floor((((buffX[sizeX-1] << 16) + buffX[sizeX-2]) >>> 0) / buffY[sizeY-1]);
			}
			else if(sizeX == 1)
			{
				q = Math.floor(buffX[sizeX-1] / buffY[sizeY-1]);
			}
			else
			{
				break;
			}
		}
		ret.highQuot = ((buffZ[3] << 16) + buffZ[2]) >>> 0;
		ret.lowQuot = ((buffZ[1] << 16) + buffZ[0]) >>> 0;
		ret.highMod = ((buffX[3] << 16) + buffX[2]) >>> 0;
		ret.lowMod = ((buffX[1] << 16) + buffX[0]) >>> 0;
		if(signX != signY && (ret.highQuot != 0 || ret.lowQuot != 0))
		{
			ret.highQuot += rad;
		}
		if(signX == 1 && (ret.highMod != 0 || ret.lowMod != 0))
		{
			ret.highMod += rad;
		}
		return ret;
	}

	var convLongStr = function(x)
	{
		var signX;
		var ret;
		var rad = Math.pow(2, 32);
		
		signX = Math.floor(x.high / rad);
		x.high = x.high % rad;

		ret = x.low.toString(16);
		while(ret.length < 8)
		{
			ret = "0" + ret;
		}
		ret = x.high.toString(16) + ret;
		if(signX == 1)
		{
			ret = "-" + ret;
		}

		return ret;
	}	

	var convLongStr10 = function(x)
	{
		var signX;
		var y = {high:0, low:10};
		var rad = Math.pow(2, 32);
		var ret;
		var str = "";
		
		signX = Math.floor(x.high / rad);
		x.high = x.high % rad;

		do
		{
			ret = doDivLong(x.high, x.low, y.high, y.low);
			str = ret.lowMod.toString() + str;
			x = {high:ret.highQuot, low:ret.lowQuot};
		}while(x.high != 0 || x.low != 0);
		
		if(signX == 1)
		{
			str = "-" + str;
		}
		
		return str;
	}

	//符号+絶対値の形から2の補数表現へ変換
	var getOpponentFromSign = function(x)
	{
		var high = x.high;
		var low = x.low;
		var sign;
		var rad = Math.pow(2, 32);

		sign = Math.floor(high / rad) >>> 0;
		high = high % rad >>> 0;
		low = low >>> 0;
		if(sign == 1)
		{
			//ビットを反転して1足す
			high = ~high >>> 0;
			low = ~low >>> 0;
			low = low + 1;
			if( low > 0xffffffff)
			{
				low = 0;
				high = high + 1;
			}
		}
		return {high:high >>> 0, low:low >>> 0};
	}

	//2の補数表現から符号+絶対値の形へ変換
	var getSignFromOpponent = function(x)
	{
		var high = x.high;
		var low = x.low;

		if(high & 0x80000000)
		{
			//負の数なので絶対値を取り出す
			//ビットを反転して1足す
			high = ~high >>> 0;
			low = ~low >>> 0;
			low = low + 1;
			if( low > 0xffffffff)
			{
				low = 0;
				high = high + 1;
			}
			high += Math.pow(2, 32);
		}
		return {high:high, low:low >>> 0}
	}

	var getLongFromInt = function(x)
	{
		var high = 0;

		if(x < 0)
		{
			x*=-1;
			high = Math.pow(2, 32);
		}

		return {high:high, low:x};
	}

	var getLongFromDouble = function(x)
	{
		var sign, high, low;
		var rad = Math.pow(2, 32);

		if(x < 0)
		{
			sign = 1;
			x *= -1;
		}
		else
		{
			sign = 0;
		}
		x = Math.floor(x);
		low = x % rad;
		high = Math.floor(x / rad) % rad + rad * sign;
		return {high:high, low:low};
	}

	var getDoubleFromLong = function(highX, lowX)
	{
		var rad = Math.pow(2, 32);
		var ret, sign;

		if(highX >= rad)
		{
			highX = highX % rad;
			sign = 1;
		}
		else
		{
			sign = 0;
		}
		ret = (highX * rad + lowX);
		if(sign == 1)
		{
			ret *= -1;
		}
		return ret; 
	}

	Method.instTable[NEW] = function(code, i, jsCodes, $cappuccino)
	{
		var cindex = (code[i+1] << 8) + code[i+2];
		var cname = $cappuccino.constantPool[cindex].value;
		jsCodes.push("jclass = CappuccinoVM.getJavaClass('" + cname  + "');");
		jsCodes.push("if(jclass == null){return {action:'loadClass', className:'" + cname + "', pc:" + i + "}}");
		jsCodes.push("vmStack[thread.stackPtr++] = new jclass();");
		return i + 3;
	}

	Method.instTable[NEWARRAY] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[thread.stackPtr-1];");
		jsCodes.push("vmStack[thread.stackPtr-1] = new Array(operand1);");
		return i + 2;
	}

	Method.instTable[ANEWARRAY] = function(code, i, jsCodes)
	{
		jsCodes.push("operand1 = vmStack[thread.stackPtr-1];");
		jsCodes.push("vmStack[thread.stackPtr-1] = new Array(operand1);");
		return i + 3;
	}

	Method.instTable[ARRAYLENGTH] = function(code, i, jsCodes)
	{
		jsCodes.push("obj = vmStack[thread.stackPtr-1];");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj.length;");
		return i + 1;
	}

	Method.instTable[ATHROW] = function(code, i, jsCodes)
	{
		jsCodes.push("throw Error('Exception is not implemented');");
		return i + 1;
	}

	var makeArray = function(vmStack, stackPtr, dim)
	{
		var array = [];
		if(dim >= 2)
		{
			var count = vmStack[stackPtr - dim];
			for(var i = 0; i < count; i++)
			{
				array.push(makeArray(vmStack, stackPtr, dim-1));
			}
		}
		return array;
	}

	Method.instTable[MULTIANEWARRAY] = function(code, i, jsCodes)
	{
		var j;
		var dim = code[i+3];
		jsCodes.push("obj = CappuccinoVM.makeArray(vmStack, thread.stackPtr, " + dim + ");");
		jsCodes.push("thread.stackPtr -=" + (dim-1) + ";");
		jsCodes.push("vmStack[thread.stackPtr-1] = obj;");
		return i + 4;
	}

	Method.instTable[LDC] = function(code, i, jsCodes, $cappuccino)
	{
		var cindex = code[i+1];
		jsCodes.push("vmStack[thread.stackPtr++] = $cappuccino.constantPool[" + cindex + "].value;");
		return i + 2;
	}

	Method.instTable[LDC2_W] = function(code, i, jsCodes, $cappuccino)
	{
		var cindex = get16BitsSigned((code[i+1] << 8) + code[i+2]);
		var tag = $cappuccino.constantPool[cindex].tag;
		if(tag == CONSTANT_LONG)
		{
			jsCodes.push("vmStack[thread.stackPtr] = $cappuccino.constantPool[" + cindex + "].low >>> 0;");
			jsCodes.push("vmStack[thread.stackPtr + 1] = $cappuccino.constantPool[" + cindex + "].high;");
		}
		else
		{
			jsCodes.push("vmStack[thread.stackPtr] = $cappuccino.constantPool[" + cindex + "].value;");
		}
		jsCodes.push("thread.stackPtr+=2;");
		return i + 3;
	}

	Method.instTable[GETSTATIC] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fieldType = $cappuccino.constantPool[index].fieldType;
		jsCodes.push("refjclass = CappuccinoVM.getJavaClass($cappuccino.constantPool[" + index + "].value.className);");
		jsCodes.push("if(refjclass == null){return {action:'loadClass', className: $cappuccino.constantPool[" + index + "].value.className, pc:" + i + "}}");
		jsCodes.push("name = $cappuccino.constantPool[" + index + "].value.name;");
		jsCodes.push("jclass = $cappuccino.findFieldOwner(name, refjclass);");
		if(fieldType == TYPE_LONG)
		{
			jsCodes.push("vmStack[thread.stackPtr++] = jclass[name].low;");
			jsCodes.push("vmStack[thread.stackPtr++] = jclass[name].high;");
		}
		else if(fieldType == TYPE_DOUBLE)
		{
			jsCodes.push("vmStack[thread.stackPtr++] = jclass[name];");
			jsCodes.push("thread.stackPtr++;");
		}
		else
		{
			jsCodes.push("vmStack[thread.stackPtr++] = jclass[name];");
		}

		return i + 3;
	}

	Method.instTable[PUTSTATIC] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fieldType = $cappuccino.constantPool[index].fieldType;
		jsCodes.push("refjclass = CappuccinoVM.getJavaClass($cappuccino.constantPool[" + index + "].value.className);");
		jsCodes.push("if(refjclass == null){return {action:'loadClass', className: $cappuccino.constantPool[" + index + "].value.className, pc:" + i + "}}");
		jsCodes.push("name = $cappuccino.constantPool[" + index + "].value.name;");
		jsCodes.push("jclass = $cappuccino.findFieldOwner(name, refjclass);");
		if(fieldType == TYPE_LONG)
		{
			jsCodes.push("jclass[name] = {high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]};");
			jsCodes.push("thread.stackPtr-=2;");
		}
		else if(fieldType == TYPE_DOUBLE)
		{
			jsCodes.push("jclass[name] = vmStack[thread.stackPtr-2];");
			jsCodes.push("thread.stackPtr-=2;");
		}
		else
		{
			jsCodes.push("jclass[name]=vmStack[--thread.stackPtr];");
		}
		return i + 3;
	}

	Method.instTable[GETFIELD] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fname = $cappuccino.constantPool[index].value.name;
		var fieldType = $cappuccino.constantPool[index].fieldType;
		jsCodes.push("obj = vmStack[thread.stackPtr-1];");
		if(fieldType == TYPE_LONG)
		{
			jsCodes.push("vmStack[thread.stackPtr-1] = obj['" + fname + "'].low;");
			jsCodes.push("vmStack[thread.stackPtr] = obj['" + fname + "'].high;");
			jsCodes.push("thread.stackPtr++;");
		}
		else if(fieldType == TYPE_DOUBLE)
		{
			jsCodes.push("vmStack[thread.stackPtr-1] = obj['" + fname + "'];");
			jsCodes.push("thread.stackPtr++;");
		}
		else
		{
			jsCodes.push("vmStack[thread.stackPtr-1] = obj['" + fname + "'];");
		}
		/*
		jsCodes.push("vmStack[thread.stackPtr-1] = obj['" + fname + "'];");
		if((fieldType == TYPE_DOUBLE) || (fieldType == TYPE_LONG))
		{
			jsCodes.push("thread.stackPtr++;");
		}
		*/
		return i + 3;
	}

	Method.instTable[PUTFIELD] = function(code, i, jsCodes, $cappuccino)
	{
		var index = (code[i+1] << 8) + code[i+2];
		var fname = $cappuccino.constantPool[index].value.name;
		var fieldType = $cappuccino.constantPool[index].fieldType;
		if(fieldType == TYPE_LONG)
		{
			jsCodes.push("operand1 = {high:vmStack[thread.stackPtr-1], low:vmStack[thread.stackPtr-2]};");
			jsCodes.push("obj = vmStack[thread.stackPtr-3];");
			jsCodes.push("thread.stackPtr -= 3;");
		}
		else if(fieldType == TYPE_DOUBLE)
		{
			jsCodes.push("operand1 = vmStack[thread.stackPtr-2];"); 
			jsCodes.push("obj = vmStack[thread.stackPtr-3];");
			jsCodes.push("thread.stackPtr -= 3;");
		}
		else
		{
			jsCodes.push("operand1 = vmStack[thread.stackPtr-1];"); 
			jsCodes.push("obj = vmStack[thread.stackPtr-2];");
			jsCodes.push("thread.stackPtr -= 2;");
		}
		jsCodes.push("obj['" + fname + "'] = operand1;");
		/*
		if((fieldType == TYPE_DOUBLE) || (fieldType == TYPE_LONG))
		{
			jsCodes.push("thread.stackPtr--;");
		}
		jsCodes.push("operand1 = vmStack[--thread.stackPtr];");
		jsCodes.push("obj = vmStack[--thread.stackPtr];");
		jsCodes.push("obj['" + fname + "'] = operand1;");
		*/
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
		jsCodes.push("sp = thread.stackPtr - methodref.paramLength - 1;");
		//jsCodes.push("CappuccinoVM.debugPrint('invokevirtual');");
		//jsCodes.push("CappuccinoVM.debugPrint(vmStack);");
		//jsCodes.push("CappuccinoVM.debugPrint(stackBase);");
		//jsCodes.push("CappuccinoVM.debugPrint(thread.stackPtr);");
		jsCodes.push("method = vmStack[sp].constructor.$cappuccino.findMethod(methodref.value.name, methodref.value.descriptor);");
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
		jsCodes.push("thread.stackPtr--;");
		jsCodes.push("return {action:'returnValue', value:vmStack[thread.stackPtr]};");
		return i + 1;
	}

	Method.instTable[DRETURN] = Method.instTable[LRETURN] = function(code, i, jsCodes)
	{
		jsCodes.push("thread.stackPtr-=2;");
		jsCodes.push("return {action:'returnValueWide', value:{high:vmStack[thread.stackPtr+1], low:vmStack[thread.stackPtr]}};");
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

		jsCodes.push("var thread = arguments[0];");
		jsCodes.push("var vmStack = arguments[0].vmStack;");
		jsCodes.push("var stackBase = arguments[0].stackBase;");
		jsCodes.push("var pc = arguments[0].pc;");
		jsCodes.push("var $cappuccino = arguments[0].currentMethod.$cappuccino;");

		//jsCodes.push("CappuccinoVM.debugPrint(vmStack);");
		//jsCodes.push("CappuccinoVM.debugPrint(stackTop);");
		//jsCodes.push("CappuccinoVM.debugPrint(pc);");
		//jsCodes.push("CappuccinoVM.debugPrint($cappuccino);");
		jsCodes.push("var methodref, jclass, refjclass, method, name, sp, operand1, operand2, obj, mask;");
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

		/*
		debugPrint("//" + this.name);
		for(i = 0; i < jsCodes.length; i++)
		{
			debugPrint(jsCodes[i]);
		}
		*/

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
					//c  = new ConstLong(classData[i], (classData[i+1] << 56) + (classData[i+2] << 48) + (classData[i+3] << 40) + (classData[i+4] << 32) + (classData[i+5] << 24) + (classData[i+6] << 16) + (classData[i+7] << 8) + classData[i+8]);
					highBytes = (classData[i+1] << 24) + (classData[i+2] << 16) + (classData[i+3] << 8) + classData[i+4];
					lowBytes = (classData[i+5] << 24) + (classData[i+6] << 16) + (classData[i+7] << 8) + classData[i+8];
					c = new ConstLong(classData[i], highBytes >>> 0, lowBytes >>> 0);
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
					//debugPrint(javaClass.$cappuccino.superClassName);
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
		var i;
		this.vmStack = [];
		this.pc = 0;
		this.stackBase = 0;
		this.stackPtr = 0;
		this.currentMethod = null;
		this.firstMethod = null;
	}

	JavaThread.prototype.run = function()
	{
		var cfunc, ret, nextBase,  numLocals, i, r, oldLength;
		while(true)
		{
			//this.currentMethod.debugPrint();
			cfunc = this.currentMethod.getCompiledMethod();
			ret = cfunc(this);
			//ret = cfunc(this.vmStack, this.stackTop, this.pc, this.currentMethod.$cappuccino);
			if(ret.action == "invoke")
			{
				//debugPrint("invoke " + ret.method.name)
				//debugPrint(ret.method.paramLength);
				//debugPrint(ret.method.codeAttr.maxLocals);
				//次のスタックが始まる位置
				//nextTop = this.vmStack.length - ret.method.paramLength;
				nextBase = this.stackPtr - ret.method.paramLength;
				if(!ret.method.isStatic())
				{
					nextBase--;
				}
				//引数以外のローカル変数の数
				numLocals = ret.method.codeAttr.maxLocals - ret.method.paramLength;
				if(!ret.method.isStatic())
				{
					numLocals--;
				}
				/*
				for(i = 0; i < numLocals; i++)
				{
					this.vmStack.push(null);
				}
				*/
				this.stackPtr += numLocals;
				this.vmStack[this.stackPtr++] = this.currentMethod;
				this.vmStack[this.stackPtr++] = this.stackBase;
				//現在のスタックフレームのサイズを保存
				this.vmStack[this.stackPtr] = this.stackPtr - ret.method.codeAttr.maxLocals - 2;
				this.stackPtr++;
				this.vmStack[this.stackPtr++] = ret.pc;
				this.currentMethod = ret.method;
				this.stackBase = nextBase;
				this.pc = 0;
				//debugPrint(this.vmStack);
				//debugPrint(this.stackBase);
				//debugPrint(this.stackPtr);
			}
			else if(ret.action == "return" || ret.action == "returnValue" || ret.action == "returnValueWide")
			{
				if(this.currentMethod == this.firstMethod)
				{
					//すべてのメソッドの終了が終わったのでスレッドを終了する
					return;
				}
				else
				{
					r = this.stackBase + this.currentMethod.codeAttr.maxLocals;
					this.currentMethod = this.vmStack[r];
					this.stackBase = this.vmStack[r+1];
					this.stackPtr = this.vmStack[r+2];
					this.pc = this.vmStack[r+3];
					if(ret.action == "returnValue")
					{
						this.vmStack[this.stackPtr] = ret.value;
						this.stackPtr++;
					}
					if(ret.action == "returnValueWide")
					{
						this.vmStack[this.stackPtr] = ret.value.low;
						this.vmStack[this.stackPtr+1] = ret.value.high;
						this.stackPtr+=2;
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
		var nextBase, numLocals, i;

		if(!this.firstMethod)
		{
			this.firstMethod = method;
		}
		for(i=1; i < arguments.length; i++)
		{
			this.vmStack[this.stackPtr++] = arguments[i];
		}

		nextBase = this.stackPtr - method.paramLength;
		if(!method.isStatic())
		{
			nextBase--;
		}
		//引数以外のローカル変数の数
		numLocals = method.codeAttr.maxLocals - method.paramLength;
		if(!method.isStatic())
		{
			numLocals--;
		}
		this.stackPtr += numLocals;
		this.vmStack[this.stackPtr++] = this.currentMethod;
		this.vmStack[this.stackPtr++] = this.stackBase;
		//現在のスタックフレームのサイズを保存
		this.vmStack[this.stackPtr] = this.vmStack.stackPtr - method.codeAttr.maxLocals - 2;
		this.stackPtr++;
		this.vmStack[this.stackPtr++] = this.pc;
		this.currentMethod = method;
		this.stackBase = nextBase;
		this.pc = 0;
		//debugPrint("invoking " + ret.method.name)
		//for(i = 0; i < this.vmStack.length; i++)
		//	debugPrint(this.vmStack[i]);
		//debugPrint("stackTop=" + nextTop);
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
		var stackBase = javaThread.stackBase;
		debugPrint(vmStack[stackBase+1]);
		return {action:"return"};
	}
	PrintStream.$cappuccino.addMethod(printlnInt);

	var printlnString = new Method(0x00, "println", "(Ljava/lang/String;)V");
	printlnString.codeAttr = new Code(0, 2, null);
	printlnString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		debugPrint(vmStack[stackBase+1].toString());
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
	//printlnLong.compiledMethod = printlnInt.compiledMethod;
	printlnLong.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		debugPrint(convLongStr10({low:vmStack[stackBase+1], high:vmStack[stackBase+2]}));
		return {action:"return"};
	}
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
		var stackBase = javaThread.stackBase;
		var thisObj = vmStack[stackBase];
		var arg = vmStack[stackBase+1];
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
		var stackBase = javaThread.stackBase;
		vmStack[stackBase].str = "";
		return {action:"return"};
	}
	StringBuilder.$cappuccino.addMethod(sbInit);

	var sbInitStr = new Method(0x0000, "<init>", "(Ljava/lang/String;)V");
	sbInitStr.codeAttr = new Code(0, 2, null);
	sbInitStr.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		vmStack[stackBase].str = vmStack[stackBase+1].str;
		return {action:"return"};
	}
	StringBuilder.$cappuccino.addMethod(sbInitStr);

	var appendInt = new Method(0x000, "append", "(I)Ljava/lang/StringBuilder;");
	appendInt.codeAttr = new Code(0, 2, null);
	appendInt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var thisObj = vmStack[stackBase];
		var arg = vmStack[stackBase+1];
		thisObj.str = thisObj.str + arg;
		return {action:"returnValue", value:thisObj};
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
	appendLong.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var thisObj = vmStack[stackBase];
		var arg = {high:vmStack[stackBase+2], low:vmStack[stackBase+1]};
		thisObj.str = thisObj.str + convLongStr10(arg);
		return {action:"returnValue", value:thisObj};
	}
	StringBuilder.$cappuccino.addMethod(appendLong);

	var appendString = new Method(0x0000, "append", "(Ljava/lang/String;)Ljava/lang/StringBuilder;");
	appendString.codeAttr = new Code(0, 2, null);
	appendString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var thisObj = vmStack[stackBase];
		var arg = vmStack[stackBase+1];
		thisObj.str = thisObj.str + arg.str;
		return {action:"returnValue", value:thisObj};
	}
	StringBuilder.$cappuccino.addMethod(appendString);

	var sbToString = new Method(0x0000, "toString", "()Ljava/lang/String;");
	sbToString.codeAttr = new Code(0, 1, null);
	sbToString.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var javaString = createJavaString(vmStack[stackBase].str);
		return {action:"returnValue", value:javaString};
	}
	StringBuilder.$cappuccino.addMethod(sbToString);

	classHash["java/lang/StringBuilder"] = StringBuilder;

	//java/lang/Math
	var JavaMath = function() {}
	JavaMath.$cappuccino = new CVMInfo(JavaMath);
	JavaMath.PI = Math.PI;

	var sqrt = new Method(0x0008, "sqrt", "(D)D");
	sqrt.codeAttr = new Code(0, 2, null);
	sqrt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		return {action: "returnValueWide", value: Math.sqrt(vmStack[stackBase])};
	}
	JavaMath.$cappuccino.addMethod(sqrt);
	
	var random = new Method(0x0008, "random", "()D");
	random.codeAttr = new Code(0, 2, null);
	random.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		return {action: "returnValueWide", value: Math.random()};
	}
	JavaMath.$cappuccino.addMethod(random);

	var sin = new Method(0x0008, "sin", "(D)D");
	sin.codeAttr = new Code(0, 2, null);
	sin.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		return {action: "returnValueWide", value: Math.sin(vmStack[stackBase])};
	}
	JavaMath.$cappuccino.addMethod(sin);

	var min = new Method(0x0008, "min", "(II)I");
	min.codeAttr = new Code(0, 2, null);
	min.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var a = vmStack[stackBase];
		var b = vmStack[stackBase+1];
		if(a>b)
		{
			return {action: "returnValue", value: b};
		}
		else
		{
			return {action: "returnValue", value: a};
		}
	}
	JavaMath.$cappuccino.addMethod(min);

	var abs = new Method(0x0008, "abs", "(D)D");
	abs.codeAttr = new Code(0, 2, null);
	abs.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		return {action: "returnValueWide", value: Math.abs(vmStack[stackBase])};
	}
	JavaMath.$cappuccino.addMethod(abs);

	var absInt = new Method(0x0008, "abs", "(I)I");
	absInt.codeAttr = new Code(0, 2, null);
	absInt.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		return {action: "returnValue", value: Math.abs(vmStack[stackBase])};
	}
	JavaMath.$cappuccino.addMethod(absInt);

	classHash["java/lang/Math"] = JavaMath;

	//java/lang/System
	var System = function() {}
	System.$cappuccino = new CVMInfo(System);
	System.out = new PrintStream();

        var currentTimeMillis = new Method(0x0008, "currentTimeMillis", "()J");
	currentTimeMillis.codeAttr = new Code(0, 0, null);
	currentTimeMillis.compiledMethod = function(javaThread)
	{
		var dd = new Date();
		return {action: "returnValueWide", value:getLongFromDouble(dd.getTime())}
	}
	System.$cappuccino.addMethod(currentTimeMillis);

	var getProperty = new Method(0x0008, "getProperty", "(Ljava/lang/String;)Ljava/lang/String;");
	getProperty.codeAttr = new Code(0, 1, null);
	getProperty.compiledMethod = function(javaThread)
	{
		var propString = createJavaString("CappuccinoVM");
		return {action: "returnValue", value: propString}
	}
	System.$cappuccino.addMethod(getProperty);

	var arraycopy = new Method(0x0008, "arraycopy", "(Ljava/lang/Object;ILjava/lang/Object;II)V");
	arraycopy.codeAttr = new Code(0, 5, null);
	arraycopy.compiledMethod = function(javaThread)
	{
		var vmStack = javaThread.vmStack;
		var stackBase = javaThread.stackBase;
		var src = vmStack[stackBase];
		var si = vmStack[stackBase + 1];
		var dst = vmStack[stackBase + 2];
		var di = vmStack[stackBase + 3];
		var num = vmStack[stackBase + 4];
		var i;
		for (i = 0; i < num; i++) 
		{
			dst[di + i] = src[si + i];
		}
		return {action: "return"};
	}
	System.$cappuccino.addMethod(arraycopy);

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
				args[i-1] = new createJavaString(arguments[i]);
			}

			loadClassfileAsync(className, javaThread, function(){javaThread.run();}, true, args);
		},

		debugPrint: debugPrint,
		getJavaClass: getJavaClass,
		makeArray: makeArray,
		createJavaString: createJavaString,
		doAddLong: doAddLong,
		doSubLong: doSubLong,
		doMulLong: doMulLong,
		doDivLong: doDivLong,
		doCmpLong: doCmpLong,
		getOpponentFromSign: getOpponentFromSign,
		getSignFromOpponent: getSignFromOpponent,
		getLongFromInt: getLongFromInt,
		getLongFromDouble: getLongFromDouble,
		getDoubleFromLong: getDoubleFromLong
	}
}
